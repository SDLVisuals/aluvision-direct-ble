import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
APP = (ROOT / "app.js").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "styles.css").read_text(encoding="utf-8")
SW = (ROOT / "service-worker.js").read_text(encoding="utf-8")


SPI_CATALOGUE_CONTRACT = """
2|Soft Gradient|GRADIENT|Gradient
3|Multi Gradient|GRADIENT|Gradient
4|Gradient Drift|GRADIENT|Gradient
5|Corporate Flow|FLOW|Corporate
6|Slow Color Flow|FLOW|Flow
7|Elegant Chase|CHASE|Chase
8|Soft Chase|CHASE|Chase
9|Thin Chase|CHASE|Chase
10|Wide Chase|CHASE|Chase
11|Dual Chase|DUAL|Chase
12|Multi Chase|CHASE|Chase
13|Comet|COMET|Dynamic
14|Soft Comet|COMET|Dynamic
15|Moving Highlight|CHASE|Professional
16|Double Highlight|DUAL|Professional
17|Premium Shimmer|SPARKLE|Ambient
18|Subtle Sparkle|SPARKLE|Ambient
19|Slow Shimmer|SPARKLE|Ambient
20|Satin Glow|BREATHE|Ambient
21|Silk Flow|FLOW|Flow
22|Breathing|BREATHE|Pulse
23|Soft Breathing|BREATHE|Pulse
24|Dual Breathing|BREATHE|Pulse
25|Pulse|BREATHE|Pulse
26|Soft Pulse|BREATHE|Pulse
27|Traveling Pulse|CHASE|Pulse
28|Wave|WAVE|Flow
29|Soft Wave|WAVE|Flow
30|Sine Wave|WAVE|Flow
31|Dual Wave|WAVE|Flow
32|Light Sweep|SCANNER|Dynamic
33|Slow Sweep|SCANNER|Dynamic
34|Edge Sweep|SCANNER|Dynamic
35|Center Sweep|MIRROR|Dynamic
36|Center Out|MIRROR|Dynamic
37|Outside In|MIRROR|Dynamic
38|Edge-to-Edge Fade|GRADIENT|Gradient
39|Cross Fade|BREATHE|Gradient
40|Color Fade|BREATHE|Gradient
41|Slow Color Transition|BREATHE|Gradient
42|Aurora Flow|FLOW|Ambient
43|Ambient Drift|FLOW|Ambient
44|Gentle Motion|FLOW|Ambient
45|Minimal Accent|MINIMAL|Minimal
46|Moving Accent|MINIMAL|Minimal
47|Corporate Accent|FLOW|Corporate
48|White Accent Flow|FLOW|Corporate
49|Warm White Flow|WARM|Corporate
51|Architectural Flow|FLOW|Professional
52|Tunnel Flow|FLOW|Professional
53|Parallel Flow|FLOW|Professional
54|Synchronized Sweep|SCANNER|Professional
55|Alternating Lines|ALTERNATE|Professional
56|Cascading Lines|CASCADE|Professional
57|Mirror Flow|MIRROR|Professional
58|Symmetric Chase|DUAL|Chase
59|Asymmetric Chase|CHASE|Chase
60|Liquid Gradient|GRADIENT|Gradient
61|Soft Liquid|GRADIENT|Gradient
62|Glow Trail|COMET|Dynamic
63|Fade Trail|COMET|Dynamic
64|Comet Trail|COMET|Dynamic
65|Light Runner|CHASE|Dynamic
66|Slow Runner|CHASE|Dynamic
67|Spotlight Travel|CHASE|Professional
68|Soft Spotlight|CHASE|Professional
69|Gradient Pulse|BREATHE|Gradient
70|Gradient Wave|WAVE|Gradient
71|Gradient Chase|CHASE|Gradient
72|Gradient Sweep|SCANNER|Gradient
73|Brand Color Flow|FLOW|Corporate
74|Brand Color Pulse|BREATHE|Corporate
75|Brand Color Chase|CHASE|Corporate
76|Exhibition Mode|FLOW|Professional
77|Welcome Flow|FLOW|Professional
78|Presentation Mode|BREATHE|Professional
79|Evening Ambient|BREATHE|Ambient
80|Product Highlight|CHASE|Professional
81|Luxury Shimmer|SPARKLE|Ambient
82|Calm Motion|FLOW|Ambient
84|Dynamic White|BREATHE|Minimal
85|White Temperature Flow|WARM|Corporate
86|Soft Strobe|SPARKLE|Dynamic
87|Accent Flash|SPARKLE|Dynamic
88|Sequence Fade|SEQUENCE|Dynamic
89|Custom Timeline|SEQUENCE|Custom
"""


TUNNEL_CATALOGUE_CONTRACT = """
90|Line Fade Down|CASCADE|Multi-line
91|Line Fade Up|CASCADE|Multi-line
92|LED Line Sequence Fade|SEQUENCE|Multi-line
93|Panel Wave|WAVE|Multi-line
94|Panel Chase|CHASE|Multi-line
95|Center Rows Out|MIRROR|Multi-line
96|Alternating Directions|DUAL|Multi-line
97|Synchronized Rows|FLOW|Multi-line
95|Tunnel Inwaarts|MIRROR|Multi-line
95|Tunnel Uitwaarts|MIRROR|Multi-line
93|Dieptegolf|WAVE|Multi-line
92|Ring-per-ring Fade|SEQUENCE|Multi-line
93|Dubbele Tunnelgolf|WAVE|Multi-line
93|Kleurdoorgifte|WAVE|Multi-line
96|Afwisselende Ringen|DUAL|Multi-line
92|Tunnelademhaling|SEQUENCE|Multi-line
94|Scanner door Diepte|CHASE|Multi-line
94|Comet door Tunnel|CHASE|Multi-line
93|Regenboogdiepte|WAVE|Multi-line
95|Center Burst|MIRROR|Multi-line
90|Echo Pulse|CASCADE|Multi-line
92|Soft Cascade|SEQUENCE|Multi-line
94|Snelle Strobe Chase|CHASE|Multi-line
93|Gradient Depth|WAVE|Multi-line
98|Whole Line Pulse|BREATHE|Whole-line
99|Whole Line Soft Fade|BREATHE|Whole-line
100|Whole Line Color Fade|GRADIENT|Whole-line
101|Whole Line Smooth Transitions|FLOW|Whole-line
102|Whole Line Flash / Strobe|SPARKLE|Whole-line
"""


def contract_rows(source):
    rows = []
    for line in source.strip().splitlines():
        variant, name, engine, family = line.split("|")
        rows.append((name, engine, family, int(variant)))
    return rows


def javascript_catalogue(start, end):
    block = APP.split(start, 1)[1].split(end, 1)[0]
    return [
        (name, engine, family, int(variant))
        for name, engine, family, variant in re.findall(
            r"\['([^']+)', '([^']+)', '([^']+)', (\d+)\]", block
        )
    ]


class Parser(HTMLParser):
    pass


class FullDirectAppContractTests(unittest.TestCase):
    def test_html_is_valid_enough_to_parse(self):
        parser = Parser()
        parser.feed(HTML)
        parser.close()

    def test_opens_as_full_app_without_old_connection_hero(self):
        self.assertNotIn("RECHTSTREEKS VIA BLUETOOTH", HTML)
        self.assertNotIn("Bedien je LED Line zonder Mac", HTML)
        self.assertNotIn("BOOT-knop 2 seconden", HTML)
        self.assertIn('id="appMain"', HTML)
        for page in ("home", "zones", "scenes", "presets", "receivers", "more"):
            self.assertIn(f'data-page="{page}"', HTML)

    def test_full_information_architecture_is_implemented(self):
        for function in (
            "renderHome", "renderZones", "renderZone", "renderGroup",
            "renderScenes", "renderPresets", "renderReceivers", "renderMore",
            "saveScene", "applyScene", "savePreset", "applyPresetToGroup",
            "saveReceiverSettings", "saveGroupReceivers",
        ):
            self.assertIn(f"function {function}", APP)

    def test_spi_catalogue_matches_the_receiver_wire_contract(self):
        actual = javascript_catalogue(
            "const SPI_EFFECTS = Object.freeze([",
            "].map((effect) => catalogueEffect(effect)))",
        )
        expected = contract_rows(SPI_CATALOGUE_CONTRACT)
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), 86)
        self.assertEqual(
            {variant for _, _, _, variant in actual},
            set(range(2, 90)) - {50, 83},
        )

    def test_tunnel_and_whole_line_catalogues_match_the_wire_contract(self):
        actual = javascript_catalogue(
            "const SPI_TUNNEL_EFFECTS = Object.freeze([",
            "].map(([effect, defaults]) => catalogueEffect(effect, { line: true, defaults })))",
        )
        expected = contract_rows(TUNNEL_CATALOGUE_CONTRACT)
        self.assertEqual(actual, expected)
        self.assertEqual({variant for _, _, _, variant in actual}, set(range(90, 103)))
        self.assertEqual(len([row for row in actual if row[3] <= 97]), 24)
        self.assertEqual(len([row for row in actual if row[3] >= 98]), 5)

    def test_rgbw_catalogue_covers_every_firmware_variant(self):
        block = APP.split("const RGBW_EFFECTS = Object.freeze([", 1)[1].split("]);", 1)[0]
        variants = {
            int(value)
            for value in re.findall(r"variant:\s*(\d+)", block)
        }
        self.assertEqual(variants, set(range(17)))
        for name, engine, variant in (
            ("Line Pulse", "SEQUENCE", 5),
            ("Line Fade", "CASCADE", 6),
            ("Line Wave", "WAVE", 7),
            ("Line Chase", "CHASE", 8),
        ):
            self.assertRegex(
                block,
                rf"name:\s*'{re.escape(name)}'.*?engine:\s*'{engine}'.*?variant:\s*{variant}",
            )

    def test_empty_groups_display_zero_without_breaking_preview_math(self):
        self.assertIn(
            "function actualLineCount(group) { return lineTargets(group).length || group.receiverIds.length; }",
            APP,
        )
        self.assertIn("function lineCount(group) { return Math.max(1, actualLineCount(group)); }", APP)
        self.assertIn("Nog geen LED Lines gekoppeld", APP)
        self.assertNotIn("group.receiverIds.length || 'Geen'", APP)
        self.assertNotIn("${lineCount(group)} ${lineCount(group) === 1", APP)

    def test_nfc_is_visible_and_bluetooth_is_one_regular_action(self):
        self.assertIn("NFC-koppeling", APP)
        self.assertIn("Bluetooth koppelen", APP)
        self.assertIn("data-action=\"connect-ble\"", APP)

    def test_direct_ble_protocol_and_exact_pairing_are_preserved(self):
        for suffix in ("1100", "1101", "1102", "1103"):
            self.assertIn(f"8f0d{suffix}-8b2b-4ca3-a9d5-8a39aaf11700", APP)
        for command in ("PAIR", "LIVE", "STATUS", "CONFIG", "UNPAIR"):
            self.assertRegex(APP, rf"TYPE:\s*['\"]{command}['\"]")
        self.assertIn("exactModernPair", APP)
        self.assertIn("replyRid === String(info.RID).toUpperCase()", APP)
        self.assertIn("transactionTail.then(run, run)", APP)

    def test_tunnel_commands_are_real_line_timed_commands(self):
        tunnel_variants = {row[3] for row in contract_rows(TUNNEL_CATALOGUE_CONTRACT)}
        self.assertTrue(set(range(98, 103)).issubset(tunnel_variants))
        for field in ("LINEDELAYMS", "LINEINDEX", "LINECOUNT", "PARALLEL", "PHASEMS"):
            self.assertIn(field, APP)
        self.assertIn("sharedPhaseMs(group)", APP)
        self.assertIn("group.layout === 'continuous' ? offset : 0", APP)
        self.assertIn("tunnel-demo", APP)
        self.assertIn("tunnelLine", CSS)

    def test_spi_branch_never_emits_port_zero(self):
        self.assertNotRegex(APP, r"\bPORT\s*:\s*0")
        self.assertIn("if (group.type === 'RGBW') fields.PORT = target.port", APP)

    def test_parallel_spi_uses_row_local_geometry(self):
        self.assertIn(
            "group.layout === 'parallel' ? Math.max(1, target.pixels) : continuousPixels",
            APP,
        )
        self.assertIn(
            "fields.GROUPPIXELS = groupPixels; fields.OFFSET = group.layout === 'continuous' ? offset : 0",
            APP,
        )

    def test_relayed_live_accepts_gateway_pending_without_weakening_durable_ack(self):
        self.assertIn("function assertExactAck(fields, targetRid, allowPending = false)", APP)
        self.assertIn("'PENDING','QUEUED'", APP)
        self.assertIn("assertExactAck(reply, targets[index].rid, true)", APP)
        self.assertNotIn("function assertExactAck(fields, targetRid, allowPending = true)", APP)

    def test_rgbw_and_spi_groups_are_kept_separate(self):
        self.assertIn("group.type === receiver.type", APP)
        self.assertIn("found.group.type !== preset.type", APP)
        self.assertIn("RGBW automatisch herkend", APP)

    def test_pixel_calibration_and_physical_side_are_persistent(self):
        self.assertIn("TEST:'FILL'", APP)
        self.assertIn("PHYSICALREVERSE", APP)
        self.assertIn("TYPE: 'CONFIG'", APP)
        self.assertIn("Groen is het begin. Rood is de laatste gekozen pixel.", APP)

    def test_bundle_is_mobile_and_offline_ready(self):
        self.assertIn("overflow-x: hidden", CSS)
        self.assertIn("@media (max-width:480px)", CSS)
        manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(manifest["start_url"], "./")
        self.assertEqual(manifest["scope"], "./")
        self.assertEqual(manifest["display"], "standalone")
        self.assertIn("aluvision-direct-", SW)
        self.assertIn("v4-full-app", SW)
        self.assertIn('styles.css?v=18.18.0-full', HTML)
        self.assertIn('app.js?v=18.18.0-full', HTML)

    def test_no_baked_credentials_or_receiver_identity(self):
        combined = APP + HTML + CSS + SW
        self.assertIn("crypto.getRandomValues", APP)
        self.assertRegex(APP, r"NETWORK:\s*db\.installationKey")
        self.assertNotRegex(APP, r"NETWORK:\s*['\"][0-9A-Fa-f]{16}['\"]")
        self.assertNotRegex(combined, r"(?i)wifi[_ -]?(ssid|password)\s*[:=]")
        self.assertNotRegex(combined, r"(?i)(api[_ -]?key|secret)\s*[:=]\s*['\"][^'\"]+")


if __name__ == "__main__":
    unittest.main()
