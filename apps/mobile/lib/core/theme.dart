import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'design_tokens.dart';

ThemeData _build(Brightness b) {
  final dark = b == Brightness.dark;
  final bg = dark ? StyraTokens.darkBackground : StyraTokens.lightBackground;
  final fg = dark ? StyraTokens.darkForeground : StyraTokens.lightForeground;
  final card = dark ? StyraTokens.darkCard : StyraTokens.lightCard;
  final border = dark ? StyraTokens.darkBorder : StyraTokens.lightBorder;
  final muted = dark ? StyraTokens.darkMutedForeground : StyraTokens.lightMutedForeground;

  final scheme = ColorScheme.fromSeed(
    seedColor: StyraTokens.primary,
    brightness: b,
    primary: StyraTokens.primary,
    secondary: StyraTokens.secondary,
    error: StyraTokens.destructive,
    surface: bg,
    onSurface: fg,
  );

  final text = GoogleFonts.interTextTheme(ThemeData(brightness: b).textTheme).apply(bodyColor: fg, displayColor: fg);
  final headings = GoogleFonts.poppinsTextTheme(text);

  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(StyraTokens.radius));

  return ThemeData(
    useMaterial3: true,
    brightness: b,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    textTheme: text.copyWith(
      headlineLarge: headings.headlineLarge,
      headlineMedium: headings.headlineMedium,
      headlineSmall: headings.headlineSmall,
      titleLarge: headings.titleLarge,
    ),
    appBarTheme: AppBarTheme(backgroundColor: bg, foregroundColor: fg, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(StyraTokens.radius),
        side: BorderSide(color: border),
      ),
    ),
    dividerColor: border,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: card,
      hintStyle: TextStyle(color: muted),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(StyraTokens.radiusSm), borderSide: BorderSide(color: border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(StyraTokens.radiusSm), borderSide: BorderSide(color: border)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(StyraTokens.radiusSm),
        borderSide: const BorderSide(color: StyraTokens.primary, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: StyraTokens.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: shape,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), shape: shape, side: BorderSide(color: border)),
    ),
    chipTheme: ChipThemeData(shape: StadiumBorder(side: BorderSide(color: border))),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xFF111118) : Colors.white,
      indicatorColor: StyraTokens.primary.withValues(alpha: 0.18),
    ),
  );
}

final styraDarkTheme = _build(Brightness.dark);
final styraLightTheme = _build(Brightness.light);
