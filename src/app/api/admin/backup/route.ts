import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

const execAsync = promisify(exec);

// Paths relative to project root
const PROJECT_ROOT = process.cwd();
const BACKUP_DIR = join(PROJECT_ROOT, 'db', 'backups');
const MANIFEST_FILE = join(BACKUP_DIR, 'backup-manifest.json');

interface BackupEntry {
  name: string;
  size: number;
  sizeFormatted: string;
  date: string;
  ageHours: number;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function parseBackupDate(filename: string): Date | null {
  const match = filename.match(/backup_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, min, sec] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
}

function readManifest(): BackupEntry[] {
  // Try to read from the JSON manifest first
  try {
    if (existsSync(MANIFEST_FILE)) {
      const content = readFileSync(MANIFEST_FILE, 'utf-8');
      const manifest = JSON.parse(content);
      if (Array.isArray(manifest.backups) && manifest.backups.length > 0) {
        const now = Date.now();
        return manifest.backups
          .map((b: Record<string, unknown>) => ({
            name: String(b.name || ''),
            size: Number(b.size || 0),
            sizeFormatted: String(b.sizeFormatted || formatBytes(Number(b.size || 0))),
            date: String(b.date || ''),
            ageHours: Math.floor(
              (now - new Date(String(b.date || '')).getTime()) / (1000 * 60 * 60)
            ),
          }))
          .filter((b: BackupEntry) => b.name.match(/^backup_\d{4}-\d{2}-\d{2}_\d{6}\.sql\.gz$/));
      }
    }
  } catch {
    // Manifest unavailable — fall through to filesystem scan
  }

  // Fallback: scan the backup directory
  return scanBackupDir();
}

function scanBackupDir(): BackupEntry[] {
  if (!existsSync(BACKUP_DIR)) return [];

  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.match(/^backup_\d{4}-\d{2}-\d{2}_\d{6}\.sql\.gz$/))
    .sort()
    .reverse();

  const now = Date.now();

  return files.map((name) => {
    const filePath = join(BACKUP_DIR, name);
    const size = statSync(filePath).size;
    const date = parseBackupDate(name);
    const dateStr = date ? date.toISOString() : '';
    const ageMs = date ? now - date.getTime() : 0;

    return {
      name,
      size,
      sizeFormatted: formatBytes(size),
      date: dateStr,
      ageHours: Math.floor(ageMs / (1000 * 60 * 60)),
    };
  });
}

// GET — List available backups with metadata
export async function GET() {
  try {
    await requireAdmin();

    const backups = readManifest();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return successResponse({
      backups,
      stats: {
        count: backups.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        oldest: backups.length > 0 ? backups[backups.length - 1].date : null,
        newest: backups.length > 0 ? backups[0].date : null,
        newestAgeHours: backups.length > 0 ? backups[0].ageHours : null,
        backupDirectory: BACKUP_DIR,
        databaseType: 'PostgreSQL (Supabase)',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST — Trigger a manual backup
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    // Check DATABASE_URL is configured
    if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
      return errorResponse('Database connection not configured. Set DATABASE_URL and DIRECT_URL.', 500);
    }

    // Run the backup script
    const scriptPath = join(PROJECT_ROOT, 'scripts', 'backup-db.sh');

    // Check script exists
    if (!existsSync(scriptPath)) {
      return errorResponse('Backup script not found at scripts/backup-db.sh', 500);
    }

    try {
      const { stdout, stderr } = await execAsync(`bash "${scriptPath}"`, {
        timeout: 120000, // 2 minute timeout
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL || '',
          DIRECT_URL: process.env.DIRECT_URL || '',
        },
      });

      // Read the updated manifest to return the new backup info
      const backups = readManifest();
      const latestBackup = backups.length > 0 ? backups[0] : null;

      return successResponse({
        message: 'Backup created successfully',
        backup: latestBackup,
        scriptOutput: stdout?.slice(-500) || '', // Last 500 chars of output
        scriptErrors: stderr?.slice(-500) || '',
      });
    } catch (execError: unknown) {
      const err = execError as { stdout?: string; stderr?: string; message?: string };
      return errorResponse(
        `Backup script failed: ${err.message || 'Unknown error'}. ${err.stderr || ''}`,
        500
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
