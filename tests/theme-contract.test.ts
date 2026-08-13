import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("SetFlow theme contract", () => {
  it("keeps native select menus on the dark SetFlow palette", () => {
    const appCss = readRepoFile("src/app/app.css");

    expect(appCss).toMatch(/select,\s*textarea\s*{[^}]*color-scheme:\s*dark/s);
    expect(appCss).toMatch(
      /select\s+option,\s*select\s+optgroup\s*{[^}]*background(?:-color)?:\s*var\(--color-surface-raised/s,
    );
    expect(appCss).toMatch(
      /select\s+option,\s*select\s+optgroup\s*{[^}]*color:\s*var\(--color-text/s,
    );
  });

  it("forces Android WebView chrome to match the dark app surface", () => {
    const stylesXml = readRepoFile(
      "android/app/src/main/res/values/styles.xml",
    );
    const colorsXml = readRepoFile(
      "android/app/src/main/res/values/colors.xml",
    );

    expect(stylesXml).toContain(
      '<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.NoActionBar">',
    );
    expect(stylesXml).toContain(
      '<item name="android:forceDarkAllowed">false</item>',
    );
    expect(stylesXml).toContain(
      '<item name="android:textColorPrimary">@color/setflow_text</item>',
    );
    expect(stylesXml).toContain(
      '<item name="android:popupBackground">@color/setflow_surface_raised</item>',
    );
    expect(colorsXml).toContain('<color name="setflow_text">#F3F5EC</color>');
    expect(colorsXml).toContain(
      '<color name="setflow_surface_raised">#20241D</color>',
    );
  });
});
