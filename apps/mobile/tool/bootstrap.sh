#!/usr/bin/env bash
# Generates the native android/ and ios/ projects around the existing Dart code,
# then applies the platform settings Styra needs. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

flutter create . --org com.styra --project-name styra_mobile --platforms android,ios
rm -f test/widget_test.dart   # template test; ours lives in test/app_test.dart
flutter pub get

MANIFEST=android/app/src/main/AndroidManifest.xml
if ! grep -q 'android.permission.INTERNET' "$MANIFEST"; then
  # Release builds need INTERNET; cleartext is allowed so you can hit a local dev server over http.
  perl -0pi -e 's#<application#<uses-permission android:name="android.permission.INTERNET"/>\n    <application android:usesCleartextTraffic="true"#' "$MANIFEST"
fi
perl -pi -e 's#android:label="styra_mobile"#android:label="Styra"#' "$MANIFEST"

PLIST=ios/Runner/Info.plist
if ! grep -q NSAppTransportSecurity "$PLIST"; then
  # Allow http to a local dev server. Remove for production builds.
  perl -0pi -e 's#<dict>#<dict>\n\t<key>NSAppTransportSecurity</key>\n\t<dict><key>NSAllowsLocalNetworking</key><true/></dict>\n\t<key>LSApplicationQueriesSchemes</key>\n\t<array><string>tel</string><string>https</string></array>#' "$PLIST"
fi
perl -pi -e 's#<string>Styra Mobile</string>#<string>Styra</string>#' "$PLIST"

flutter analyze
echo "Done. Run: flutter run --dart-define=API_BASE_URL=http://<your-ip>:3000"
