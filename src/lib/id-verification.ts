/**
 * ID Verification Utility — Government Record Verification Pipeline
 *
 * Performs a multi-step verification combining:
 *   1. Web Search for government records using the ID number
 *   2. Page Reader for relevant government/verification pages
 *   3. VLM analysis of ID document image (if available)
 *   4. LLM cross-referencing of all evidence
 *   5. Returns a comprehensive verification result
 *
 * Graceful degradation: if web search fails, still uses VLM/LLM verification.
 */

import ZAI from 'z-ai-web-dev-sdk';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IdVerificationParams {
  zai: ZAI;
  idType: string | null;       // PASSPORT, NATIONAL_ID, DRIVERS_LICENSE
  idNumber: string | null;
  idDocumentUrl: string | null;
  businessName: string;
}

export interface WebSearchEvidence {
  searchQuery: string;
  resultsFound: number;
  relevantResults: Array<{ url: string; snippet: string }>;
  governmentRecordMatch: boolean;
  details: string;
}

export interface IdVerificationResult {
  verified: boolean;
  documentTypeMatch: boolean;
  appearsAuthentic: boolean;
  extractedName?: string;
  extractedIdNumber?: string;
  confidence: number;
  notes: string;
  webSearchEvidence?: WebSearchEvidence;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a web search query based on the ID type and number.
 * Targets Kenyan government and public record sources.
 */
function buildSearchQuery(idType: string | null, idNumber: string | null): string {
  const type = (idType || 'NATIONAL_ID').toUpperCase();

  switch (type) {
    case 'PASSPORT':
      return `Kenya passport ${idNumber || ''} verification government site:eCitizen.go.ke OR site:immigration.go.ke`;
    case 'DRIVERS_LICENSE':
      return `Kenya driving license ${idNumber || ''} verification NTSA site:ntsa.go.ke OR site:ecitizen.go.ke`;
    case 'NATIONAL_ID':
    default:
      return `Kenya national ID ${idNumber || ''} verification NRB site:ecitizen.go.ke OR site:interior.go.ke`;
  }
}

/**
 * Build a broader secondary search query to catch additional public records.
 */
function buildSecondarySearchQuery(idType: string | null, idNumber: string | null, businessName: string): string {
  const type = (idType || 'NATIONAL_ID').toUpperCase();
  const typeLabel = type === 'PASSPORT' ? 'passport' : type === 'DRIVERS_LICENSE' ? 'driving license' : 'national ID';

  return `verify Kenya ${typeLabel} ${idNumber || ''} "${businessName}" public records`;
}

/**
 * Safely parse JSON from an AI response content string.
 */
function safeParseAiContent(content: unknown): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return typeof content === 'string' ? JSON.parse(content) : (content as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Check if a URL looks like a government or official verification site.
 */
function isGovernmentUrl(url: string): boolean {
  const govPatterns = [
    '.go.ke', 'ecitizen', 'ntsa', 'immigration', 'interior',
    'kra.go.ke', 'huduma', 'nrb.go.ke', 'kenya.gov',
    '.gov', 'government',
  ];
  const lower = url.toLowerCase();
  return govPatterns.some((p) => lower.includes(p));
}

// ── Step 1: Web Search for Government Records ──────────────────────────────

async function searchGovernmentRecords(
  zai: ZAI,
  idType: string | null,
  idNumber: string | null,
  businessName: string,
): Promise<{ primary: WebSearchEvidence | null; secondary: WebSearchEvidence | null }> {
  let primary: WebSearchEvidence | null = null;
  let secondary: WebSearchEvidence | null = null;

  // ── Primary search: targeted government site search ──
  try {
    const primaryQuery = buildSearchQuery(idType, idNumber);
    console.log(`[ID Verification] Primary web search: "${primaryQuery}"`);

    const searchResults = await zai.functions.invoke('web_search', {
      query: primaryQuery,
      num: 10,
    });

    const relevantResults = (searchResults || [])
      .filter((r: { url?: string; snippet?: string }) => r.url && r.snippet)
      .map((r: { url: string; snippet: string }) => ({ url: r.url, snippet: r.snippet }));

    const governmentResults = relevantResults.filter((r: { url: string }) => isGovernmentUrl(r.url));

    primary = {
      searchQuery: primaryQuery,
      resultsFound: searchResults?.length || 0,
      relevantResults: relevantResults.slice(0, 8),
      governmentRecordMatch: governmentResults.length > 0,
      details: governmentResults.length > 0
        ? `Found ${governmentResults.length} government/official site result(s) referencing this ID type and number.`
        : `No direct government record matches found for this ${idType || 'ID'} number.`,
    };
  } catch (err) {
    console.error('[ID Verification] Primary web search failed:', err instanceof Error ? err.message : err);
  }

  // ── Secondary search: broader public records search ──
  try {
    const secondaryQuery = buildSecondarySearchQuery(idType, idNumber, businessName);
    console.log(`[ID Verification] Secondary web search: "${secondaryQuery}"`);

    const searchResults2 = await zai.functions.invoke('web_search', {
      query: secondaryQuery,
      num: 8,
    });

    const relevantResults2 = (searchResults2 || [])
      .filter((r: { url?: string; snippet?: string }) => r.url && r.snippet)
      .map((r: { url: string; snippet: string }) => ({ url: r.url, snippet: r.snippet }));

    const governmentResults2 = relevantResults2.filter((r: { url: string }) => isGovernmentUrl(r.url));

    secondary = {
      searchQuery: secondaryQuery,
      resultsFound: searchResults2?.length || 0,
      relevantResults: relevantResults2.slice(0, 5),
      governmentRecordMatch: governmentResults2.length > 0,
      details: governmentResults2.length > 0
        ? `Found ${governmentResults2.length} additional government/official reference(s).`
        : 'No additional government records found in broader search.',
    };
  } catch (err) {
    console.error('[ID Verification] Secondary web search failed:', err instanceof Error ? err.message : err);
  }

  return { primary, secondary };
}

// ── Step 2: Read relevant government pages for verification criteria ───────

async function readGovernmentPages(
  zai: ZAI,
  searchEvidence: { primary: WebSearchEvidence | null; secondary: WebSearchEvidence | null },
): Promise<Array<{ url: string; content: string; title: string }>> {
  const pages: Array<{ url: string; content: string; title: string }> = [];

  // Collect URLs from both primary and secondary results, prioritizing government URLs
  const allResults = [
    ...(searchEvidence.primary?.relevantResults || []),
    ...(searchEvidence.secondary?.relevantResults || []),
  ];

  // Prioritize government URLs, then take up to 3 pages to read
  const governmentUrls = allResults.filter((r) => isGovernmentUrl(r.url));
  const otherUrls = allResults.filter((r) => !isGovernmentUrl(r.url));
  const urlsToRead = [...governmentUrls, ...otherUrls].slice(0, 3);

  for (const result of urlsToRead) {
    try {
      console.log(`[ID Verification] Reading page: ${result.url}`);
      const pageResult = await zai.functions.invoke('page_reader', { url: result.url });

      if (pageResult?.data?.html) {
        // Strip HTML tags to get plain text (basic approach)
        const plainText = pageResult.data.html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 3000); // Limit content to avoid token overflow

        pages.push({
          url: result.url,
          content: plainText,
          title: pageResult.data.title || result.url,
        });
      }
    } catch (err) {
      console.error(`[ID Verification] Failed to read page ${result.url}:`, err instanceof Error ? err.message : err);
    }
  }

  return pages;
}

// ── Step 3: VLM analysis of ID document image ─────────────────────────────

async function analyzeDocumentWithVlm(
  zai: ZAI,
  idType: string | null,
  idNumber: string | null,
  businessName: string,
  idDocumentUrl: string,
): Promise<{
  verified: boolean;
  documentTypeMatch: boolean;
  appearsAuthentic: boolean;
  extractedName?: string;
  extractedIdNumber?: string;
  confidence: number;
  notes: string;
} | null> {
  try {
    console.log('[ID Verification] Running VLM analysis on ID document image');

    const result = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'system',
          content:
            'You are a document verification expert specializing in Kenyan identification documents. ' +
            'Analyze the provided ID document image and determine if it appears to be a legitimate ' +
            'government-issued identification document. Check for: ' +
            '1) Document type matches declared type (Kenyan National ID, Passport, or Driving License) ' +
            '2) Document appears authentic (proper formatting, security features visible, watermarks, holograms) ' +
            '3) Information is legible and consistent ' +
            '4) Photo is present and clear ' +
            '5) Any visible security features typical of the document type ' +
            'Respond in JSON format only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please verify this ${idType || 'ID'} document (number: ${idNumber || 'not provided'}) ` +
                `for business registration by "${businessName}". Does the document appear legitimate? ` +
                `Does the document type match? Extract any visible name or ID number from the document. ` +
                `Note any security features you can observe.`,
            },
            {
              type: 'image_url',
              image_url: { url: idDocumentUrl },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    } as any);

    const content = result?.choices?.[0]?.message?.content;
    const parsed = safeParseAiContent(content);

    if (!parsed) {
      console.warn('[ID Verification] VLM returned unparseable content');
      return null;
    }

    return {
      verified: parsed.verified === true || parsed.legitimate === true || parsed.isLegitimate === true,
      documentTypeMatch: parsed.documentTypeMatch === true || parsed.typeMatch === true,
      appearsAuthentic: parsed.appearsAuthentic === true || parsed.authentic === true,
      extractedName: (parsed.extractedName || parsed.name || parsed.visibleName) as string | undefined,
      extractedIdNumber: (parsed.extractedIdNumber || parsed.idNumber || parsed.visibleIdNumber) as string | undefined,
      confidence: (parsed.confidence ?? parsed.confidenceScore ?? 0) as number,
      notes: (parsed.notes || parsed.reasoning || parsed.explanation || '') as string,
    };
  } catch (err) {
    console.error('[ID Verification] VLM analysis failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Step 4: LLM cross-referencing of all evidence ──────────────────────────

async function crossReferenceEvidence(
  zai: ZAI,
  idType: string | null,
  idNumber: string | null,
  businessName: string,
  vlmResult: ReturnType<typeof analyzeDocumentWithVlm> extends Promise<infer T> ? T : never,
  searchEvidence: { primary: WebSearchEvidence | null; secondary: WebSearchEvidence | null },
  pageContents: Array<{ url: string; content: string; title: string }>,
): Promise<IdVerificationResult> {
  try {
    console.log('[ID Verification] Running LLM cross-reference analysis');

    // Build a comprehensive evidence summary for the LLM
    const evidenceParts: string[] = [];

    evidenceParts.push(`ID Type: ${idType || 'unknown'}`);
    evidenceParts.push(`ID Number: ${idNumber || 'not provided'}`);
    evidenceParts.push(`Business Name: ${businessName}`);

    if (vlmResult) {
      evidenceParts.push('\n--- VLM Document Analysis ---');
      evidenceParts.push(`Verified: ${vlmResult.verified}`);
      evidenceParts.push(`Document Type Match: ${vlmResult.documentTypeMatch}`);
      evidenceParts.push(`Appears Authentic: ${vlmResult.appearsAuthentic}`);
      evidenceParts.push(`Extracted Name: ${vlmResult.extractedName || 'not visible'}`);
      evidenceParts.push(`Extracted ID Number: ${vlmResult.extractedIdNumber || 'not visible'}`);
      evidenceParts.push(`Confidence: ${vlmResult.confidence}`);
      evidenceParts.push(`Notes: ${vlmResult.notes}`);
    } else {
      evidenceParts.push('\n--- VLM Document Analysis ---');
      evidenceParts.push('No document image was available for visual analysis.');
    }

    if (searchEvidence.primary) {
      evidenceParts.push('\n--- Web Search Evidence (Primary) ---');
      evidenceParts.push(`Search Query: ${searchEvidence.primary.searchQuery}`);
      evidenceParts.push(`Results Found: ${searchEvidence.primary.resultsFound}`);
      evidenceParts.push(`Government Record Match: ${searchEvidence.primary.governmentRecordMatch}`);
      evidenceParts.push(`Details: ${searchEvidence.primary.details}`);
      if (searchEvidence.primary.relevantResults.length > 0) {
        evidenceParts.push('Top Results:');
        searchEvidence.primary.relevantResults.forEach((r, i) => {
          evidenceParts.push(`  ${i + 1}. ${r.url}: ${r.snippet}`);
        });
      }
    }

    if (searchEvidence.secondary) {
      evidenceParts.push('\n--- Web Search Evidence (Secondary) ---');
      evidenceParts.push(`Search Query: ${searchEvidence.secondary.searchQuery}`);
      evidenceParts.push(`Results Found: ${searchEvidence.secondary.resultsFound}`);
      evidenceParts.push(`Government Record Match: ${searchEvidence.secondary.governmentRecordMatch}`);
      evidenceParts.push(`Details: ${searchEvidence.secondary.details}`);
    }

    if (pageContents.length > 0) {
      evidenceParts.push('\n--- Government Page Contents ---');
      pageContents.forEach((page) => {
        evidenceParts.push(`Page: ${page.title} (${page.url})`);
        evidenceParts.push(page.content.substring(0, 1500));
      });
    }

    const evidenceText = evidenceParts.join('\n');

    const result = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a senior ID verification analyst for a Kenyan business registration platform. ' +
            'Your job is to cross-reference ALL available evidence and make a final verification decision. ' +
            '\n\n' +
            'You must evaluate:\n' +
            '1. Does the VLM document analysis support authenticity? (if available)\n' +
            '2. Do web search results show government verification services or records for this ID?\n' +
            '3. Do any government page contents contain verification criteria or services?\n' +
            '4. Does the extracted name/number from the document match the declared information?\n' +
            '5. Is the overall evidence sufficient to verify this identity?\n\n' +
            'IMPORTANT GUIDELINES:\n' +
            '- Government websites (ecitizen.go.ke, ntsa.go.ke, immigration.go.ke) that reference ID verification ' +
            'services are POSITIVE signals, even if they do not directly confirm this specific ID number.\n' +
            '- Finding the official verification portal is evidence that such records exist and can be checked.\n' +
            '- If the document appears authentic AND government verification services exist, lean toward verified.\n' +
            '- If the document appears fake or tampered, always reject regardless of web search results.\n' +
            '- If web search found NO relevant results AND no document image was provided, set verified=false.\n\n' +
            'Respond in JSON format with these fields:\n' +
            '- verified: boolean (final decision)\n' +
            '- documentTypeMatch: boolean (does the document type match declared type)\n' +
            '- appearsAuthentic: boolean (does the document appear authentic)\n' +
            '- extractedName: string or null\n' +
            '- extractedIdNumber: string or null\n' +
            '- confidence: number 0-100\n' +
            '- notes: string (detailed explanation of your reasoning, cite evidence sources)',
        },
        {
          role: 'user',
          content: `Please analyze all the evidence below and make a final verification decision for this ID:\n\n${evidenceText}`,
        },
      ],
      response_format: { type: 'json_object' },
    } as any);

    const content = result?.choices?.[0]?.message?.content;
    const parsed = safeParseAiContent(content);

    if (parsed) {
      // Merge web search evidence into result
      const combinedEvidence: WebSearchEvidence = {
        searchQuery: [
          searchEvidence.primary?.searchQuery,
          searchEvidence.secondary?.searchQuery,
        ].filter(Boolean).join(' | '),
        resultsFound: (searchEvidence.primary?.resultsFound || 0) + (searchEvidence.secondary?.resultsFound || 0),
        relevantResults: [
          ...(searchEvidence.primary?.relevantResults || []),
          ...(searchEvidence.secondary?.relevantResults || []),
        ].slice(0, 10),
        governmentRecordMatch:
          (searchEvidence.primary?.governmentRecordMatch || false) ||
          (searchEvidence.secondary?.governmentRecordMatch || false),
        details: [
          searchEvidence.primary?.details,
          searchEvidence.secondary?.details,
        ].filter(Boolean).join(' '),
      };

      return {
        verified: parsed.verified === true,
        documentTypeMatch: parsed.documentTypeMatch === true,
        appearsAuthentic: parsed.appearsAuthentic === true,
        extractedName: (parsed.extractedName as string) || vlmResult?.extractedName || undefined,
        extractedIdNumber: (parsed.extractedIdNumber as string) || vlmResult?.extractedIdNumber || undefined,
        confidence: (parsed.confidence as number) ?? 0,
        notes: (parsed.notes as string) || '',
        webSearchEvidence: combinedEvidence,
      };
    }
  } catch (err) {
    console.error('[ID Verification] LLM cross-reference failed:', err instanceof Error ? err.message : err);
  }

  // Fallback: use VLM result alone if cross-reference failed
  if (vlmResult) {
    return {
      ...vlmResult,
      webSearchEvidence: searchEvidence.primary
        ? {
            searchQuery: searchEvidence.primary.searchQuery,
            resultsFound: searchEvidence.primary.resultsFound,
            relevantResults: searchEvidence.primary.relevantResults,
            governmentRecordMatch: searchEvidence.primary.governmentRecordMatch,
            details: `${searchEvidence.primary.details} (Cross-reference step failed; VLM-only result)`,
          }
        : undefined,
    };
  }

  // Last resort: no VLM, no cross-reference
  return {
    verified: false,
    documentTypeMatch: false,
    appearsAuthentic: false,
    confidence: 0,
    notes: 'Verification failed: both VLM analysis and LLM cross-reference were unavailable.',
  };
}

// ── Step 4b: LLM text-only verification (no document image) ────────────────

async function textOnlyVerification(
  zai: ZAI,
  idType: string | null,
  idNumber: string | null,
  businessName: string,
  searchEvidence: { primary: WebSearchEvidence | null; secondary: WebSearchEvidence | null },
  pageContents: Array<{ url: string; content: string; title: string }>,
): Promise<IdVerificationResult> {
  try {
    console.log('[ID Verification] Running text-only verification with web search evidence');

    const evidenceParts: string[] = [];
    evidenceParts.push(`ID Type: ${idType || 'unknown'}`);
    evidenceParts.push(`ID Number: ${idNumber || 'not provided'}`);
    evidenceParts.push(`Business Name: ${businessName}`);

    if (searchEvidence.primary) {
      evidenceParts.push('\n--- Web Search Evidence (Primary) ---');
      evidenceParts.push(`Search Query: ${searchEvidence.primary.searchQuery}`);
      evidenceParts.push(`Results Found: ${searchEvidence.primary.resultsFound}`);
      evidenceParts.push(`Government Record Match: ${searchEvidence.primary.governmentRecordMatch}`);
      evidenceParts.push(`Details: ${searchEvidence.primary.details}`);
      if (searchEvidence.primary.relevantResults.length > 0) {
        evidenceParts.push('Top Results:');
        searchEvidence.primary.relevantResults.forEach((r, i) => {
          evidenceParts.push(`  ${i + 1}. ${r.url}: ${r.snippet}`);
        });
      }
    }

    if (searchEvidence.secondary) {
      evidenceParts.push('\n--- Web Search Evidence (Secondary) ---');
      evidenceParts.push(`Search Query: ${searchEvidence.secondary.searchQuery}`);
      evidenceParts.push(`Results Found: ${searchEvidence.secondary.resultsFound}`);
      evidenceParts.push(`Government Record Match: ${searchEvidence.secondary.governmentRecordMatch}`);
      evidenceParts.push(`Details: ${searchEvidence.secondary.details}`);
    }

    if (pageContents.length > 0) {
      evidenceParts.push('\n--- Government Page Contents ---');
      pageContents.forEach((page) => {
        evidenceParts.push(`Page: ${page.title} (${page.url})`);
        evidenceParts.push(page.content.substring(0, 1500));
      });
    }

    const evidenceText = evidenceParts.join('\n');

    const result = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a document verification expert for a Kenyan business registration platform. ' +
            'No document image was provided — you must verify based on the ID number format, ' +
            'web search results, and government page contents.\n\n' +
            'Evaluate:\n' +
            '1. Does the ID number format match the declared ID type? (Kenyan National IDs are typically 8 digits, ' +
            'Passports start with a letter followed by digits, Driving Licenses have specific formats)\n' +
            '2. Do web search results show that government verification services exist for this ID type?\n' +
            '3. Do government page contents describe verification criteria?\n' +
            '4. Is the ID number plausible for the declared type?\n\n' +
            'Without a document image, you should be MORE cautious. A positive verification requires ' +
            'that the ID format is valid AND government verification infrastructure exists.\n\n' +
            'Respond in JSON format with: verified, documentTypeMatch, appearsAuthentic, extractedIdNumber, confidence (0-100), notes.',
        },
        {
          role: 'user',
          content: `Please verify this ID based on the available evidence:\n\n${evidenceText}`,
        },
      ],
      response_format: { type: 'json_object' },
    } as any);

    const content = result?.choices?.[0]?.message?.content;
    const parsed = safeParseAiContent(content);

    if (parsed) {
      const combinedEvidence: WebSearchEvidence = {
        searchQuery: [
          searchEvidence.primary?.searchQuery,
          searchEvidence.secondary?.searchQuery,
        ].filter(Boolean).join(' | '),
        resultsFound: (searchEvidence.primary?.resultsFound || 0) + (searchEvidence.secondary?.resultsFound || 0),
        relevantResults: [
          ...(searchEvidence.primary?.relevantResults || []),
          ...(searchEvidence.secondary?.relevantResults || []),
        ].slice(0, 10),
        governmentRecordMatch:
          (searchEvidence.primary?.governmentRecordMatch || false) ||
          (searchEvidence.secondary?.governmentRecordMatch || false),
        details: [
          searchEvidence.primary?.details,
          searchEvidence.secondary?.details,
        ].filter(Boolean).join(' '),
      };

      return {
        verified: parsed.verified === true,
        documentTypeMatch: parsed.documentTypeMatch === true,
        appearsAuthentic: parsed.appearsAuthentic === true,
        extractedIdNumber: (parsed.extractedIdNumber as string) || idNumber || undefined,
        confidence: (parsed.confidence as number) ?? 0,
        notes: (parsed.notes as string) || '',
        webSearchEvidence: combinedEvidence,
      };
    }
  } catch (err) {
    console.error('[ID Verification] Text-only verification failed:', err instanceof Error ? err.message : err);
  }

  // Fallback: basic format check
  const formatResult = basicFormatCheck(idType, idNumber);

  return {
    verified: false,
    documentTypeMatch: formatResult.formatMatchesType,
    appearsAuthentic: false,
    extractedIdNumber: idNumber || undefined,
    confidence: formatResult.confidence,
    notes: `Verification inconclusive: ${formatResult.notes}. No document image provided and AI analysis was unavailable.`,
    webSearchEvidence: searchEvidence.primary
      ? {
          searchQuery: searchEvidence.primary.searchQuery,
          resultsFound: searchEvidence.primary.resultsFound,
          relevantResults: searchEvidence.primary.relevantResults,
          governmentRecordMatch: searchEvidence.primary.governmentRecordMatch,
          details: searchEvidence.primary.details,
        }
      : undefined,
  };
}

/**
 * Basic format check for Kenyan ID numbers.
 * Used as a last-resort fallback when AI analysis is unavailable.
 */
function basicFormatCheck(idType: string | null, idNumber: string | null): {
  formatMatchesType: boolean;
  confidence: number;
  notes: string;
} {
  if (!idNumber) {
    return { formatMatchesType: false, confidence: 0, notes: 'No ID number provided' };
  }

  const type = (idType || '').toUpperCase();
  const trimmed = idNumber.trim();

  switch (type) {
    case 'NATIONAL_ID':
      // Kenyan national IDs are typically 8 digits
      if (/^\d{7,8}$/.test(trimmed)) {
        return { formatMatchesType: true, confidence: 30, notes: 'ID number format consistent with Kenyan National ID (7-8 digits)' };
      }
      return { formatMatchesType: false, confidence: 10, notes: 'ID number format does not match Kenyan National ID (expected 7-8 digits)' };

    case 'PASSPORT':
      // Kenyan passports typically start with a letter followed by digits
      if (/^[A-Z]\d{6,8}$/i.test(trimmed)) {
        return { formatMatchesType: true, confidence: 30, notes: 'ID number format consistent with Kenyan Passport (letter + digits)' };
      }
      return { formatMatchesType: false, confidence: 10, notes: 'ID number format does not match Kenyan Passport (expected letter + digits)' };

    case 'DRIVERS_LICENSE':
      // Kenyan driving licenses have various formats
      if (trimmed.length >= 5 && trimmed.length <= 12) {
        return { formatMatchesType: true, confidence: 25, notes: 'ID number format possibly consistent with Kenyan Driving License' };
      }
      return { formatMatchesType: false, confidence: 10, notes: 'ID number format does not appear consistent with Kenyan Driving License' };

    default:
      return { formatMatchesType: false, confidence: 5, notes: 'Unknown ID type, cannot validate format' };
  }
}

// ── Main Export ────────────────────────────────────────────────────────────

/**
 * Perform comprehensive ID verification combining government web search,
 * document image analysis, and LLM cross-referencing.
 *
 * @param params - Verification parameters including ZAI SDK instance, ID info, and business name
 * @returns Comprehensive verification result with web search evidence
 */
export async function performIdVerification(params: IdVerificationParams): Promise<IdVerificationResult> {
  const { zai, idType, idNumber, idDocumentUrl, businessName } = params;

  console.log(`[ID Verification] Starting verification for ${idType} ${idNumber}, business: ${businessName}`);

  // ── Step 1: Web Search for government records ──
  const searchEvidence = await searchGovernmentRecords(zai, idType, idNumber, businessName);

  // ── Step 2: Read relevant government pages ──
  const pageContents = await readGovernmentPages(zai, searchEvidence);

  // ── Step 3: VLM analysis (if document image available) ──
  let vlmResult: Awaited<ReturnType<typeof analyzeDocumentWithVlm>> = null;
  if (idDocumentUrl) {
    vlmResult = await analyzeDocumentWithVlm(zai, idType, idNumber, businessName, idDocumentUrl);
  }

  // ── Step 4: Cross-reference all evidence ──
  let finalResult: IdVerificationResult;

  if (idDocumentUrl && vlmResult !== null) {
    // Document image available + VLM succeeded → full cross-reference
    finalResult = await crossReferenceEvidence(
      zai, idType, idNumber, businessName, vlmResult, searchEvidence, pageContents,
    );
  } else if (idDocumentUrl && vlmResult === null) {
    // Document image available but VLM failed → still cross-reference with web search
    console.warn('[ID Verification] VLM failed, attempting cross-reference with web search only');
    finalResult = await textOnlyVerification(zai, idType, idNumber, businessName, searchEvidence, pageContents);
  } else {
    // No document image → text-only verification with web search
    finalResult = await textOnlyVerification(zai, idType, idNumber, businessName, searchEvidence, pageContents);
  }

  console.log(
    `[ID Verification] Result: verified=${finalResult.verified}, confidence=${finalResult.confidence}, ` +
    `governmentMatch=${finalResult.webSearchEvidence?.governmentRecordMatch || false}`,
  );

  return finalResult;
}
