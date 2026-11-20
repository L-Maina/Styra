// GENERATED MIRROR — do not edit by hand.
// Source of truth: web design tokens in src/app/globals.css (owned by the web UI workstream).
// When the web tokens change, update the values here to match.
import 'package:flutter/painting.dart';

class StyraTokens {
  StyraTokens._();

  // Brand
  static const primary = Color(0xFF6C4EFF);
  static const primaryLight = Color(0xFF7A6CFF);
  static const secondary = Color(0xFF3ABEFF);
  static const secondaryLight = Color(0xFF6FE3FF);
  static const destructive = Color(0xFFEF4444);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);

  // Dark (default)
  static const darkBackground = Color(0xFF0B0B0F);
  static const darkForeground = Color(0xFFFFFFFF);
  static const darkCard = Color(0x991F2937); // rgba(31,41,55,0.6)
  static const darkMuted = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
  static const darkMutedForeground = Color(0xFF94A3B8);
  static const darkBorder = Color(0x1AFFFFFF); // rgba(255,255,255,0.1)
  static const darkSecondaryForeground = Color(0xFFE5E7EB);

  // Light
  static const lightBackground = Color(0xFFF8FAFC);
  static const lightForeground = Color(0xFF0F172A);
  static const lightCard = Color(0xCCFFFFFF); // rgba(255,255,255,0.8)
  static const lightMuted = Color(0xCCF1F5F9);
  static const lightMutedForeground = Color(0xFF64748B);
  static const lightBorder = Color(0x3394A3B8); // rgba(148,163,184,0.2)

  // Radius (1rem = 16px)
  static const radiusSm = 8.0;
  static const radius = 16.0;
  static const radiusLg = 20.0;
  static const radiusXl = 24.0;

  static const brandGradient = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
