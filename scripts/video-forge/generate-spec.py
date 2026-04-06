#!/usr/bin/env python3
"""
F138 Video Spec Generator
voice-script.md + asset-markers.md → editorial video-spec.json

Usage:
  python generate-spec.py \
    --script docs/videos/showcase-60s/voice-script.md \
    --markers docs/videos/showcase-60s/asset-markers.md \
    --output docs/videos/showcase-60s/video-spec.json

Generates an 'editorial' status spec. To upgrade to 'render-ready':
  1. Run CosyVoice to produce global audio
  2. Run align.py to get word_timestamps
  3. Run this script with --upgrade-render-ready --audio ... --timestamps ...
"""

import argparse
import json
import re
import sys
from pathlib import Path


def parse_voice_script(path: str) -> dict:
    """Parse voice-script.md → { full_text, segments: [{ id, text, est_sec }] }"""
    content = Path(path).read_text(encoding="utf-8")

    # Extract full script between "## 完整剧本" and next "##"
    full_match = re.search(
        r"## 完整剧本.*?\n\n(.*?)(?=\n---|\n## )", content, re.DOTALL
    )
    full_text = full_match.group(1).strip() if full_match else ""

    # Extract segment table (header row + separator row + data rows)
    segments = []
    table_match = re.search(
        r"## 分段对照表[^\n]*\n+\|[^\n]+\n\|[-| ]+\n((?:\|[^\n]+\n)*)", content
    )
    if table_match:
        for row in table_match.group(1).strip().split("\n"):
            cols = [c.strip() for c in row.split("|")[1:-1]]
            if len(cols) >= 4:
                seg_num = cols[0].strip()
                scene = cols[1].strip()
                text = cols[2].strip()
                est = cols[3].strip()
                # Parse ~14s → 14000
                sec_match = re.search(r"~?(\d+)s", est)
                est_ms = int(sec_match.group(1)) * 1000 if sec_match else 10000
                segments.append({
                    "num": seg_num,
                    "scene": scene,
                    "text": text,
                    "est_ms": est_ms,
                })

    return {"full_text": full_text, "segments": segments}


def generate_editorial_spec(
    script_data: dict,
    project_id: str = "showcase-60s",
    speaker: str = "opus",
    fps: int = 30,
) -> dict:
    """Generate editorial-status video-spec from parsed script data."""
    segments_data = script_data["segments"]

    # Compute timeline ranges from estimated durations
    cursor_ms = 0
    segments = []
    narration_cursor_ms = 0

    for i, seg in enumerate(segments_data):
        # Generate ASCII-safe seg id from scene name
        scene_slug = re.sub(r'[^a-zA-Z0-9]', '', seg.get('scene', ''))[:12].lower() or f"s{i+1}"
        seg_id = f"seg-{i+1:02d}-{scene_slug}"
        duration_ms = seg["est_ms"]

        segments.append({
            "id": seg_id,
            "source": {
                "type": "screen_recording",
                "timeline_range": {
                    "start_ms": cursor_ms,
                    "end_ms": cursor_ms + duration_ms,
                },
                "visual_summary": seg["scene"],
            },
            "narration": {
                "global_audio_range": {
                    "start_ms": narration_cursor_ms,
                    "end_ms": narration_cursor_ms + duration_ms,
                },
                "target_duration_ms": duration_ms,
            },
            "render": {
                "template_id": "default",
                "retiming_strategy": "TRIM",
                "vibe": "warm",
                "captions_style": "narration",
            },
            "control": {
                "review_state": "pending",
                "version": 1,
            },
        })
        cursor_ms += duration_ms
        narration_cursor_ms += duration_ms

    # Generate edges (all fade for now)
    edges = []
    for i in range(len(segments) - 1):
        edges.append({
            "from_segment_id": segments[i]["id"],
            "to_segment_id": segments[i + 1]["id"],
            "transition_type": "fade",
            "duration_ms": 500,
        })

    return {
        "id": project_id,
        "version": 1,
        "status": "editorial",
        "meta": {
            "title": f"Cat Cafe {project_id}",
            "target_duration_ms": cursor_ms,
            "fps": fps,
            "resolution": {"width": 1920, "height": 1080},
        },
        "global_audio": {
            "script_text": script_data["full_text"],
            "speaker_id": speaker,
        },
        "segments": segments,
        "edges": edges,
    }


def upgrade_to_render_ready(
    spec: dict,
    audio_uri: str,
    timestamps_path: str,
    alignment_source: str = "qwen3-fa",
) -> dict:
    """Upgrade editorial spec to render-ready by adding audio + timestamps."""
    timestamps = json.loads(Path(timestamps_path).read_text(encoding="utf-8"))

    spec["status"] = "render-ready"
    spec["global_audio"]["audio_uri"] = audio_uri
    spec["global_audio"]["word_timestamps"] = timestamps
    spec["global_audio"]["alignment_source"] = alignment_source
    return spec


def main():
    parser = argparse.ArgumentParser(description="Generate video-spec.json from voice-script + markers")
    parser.add_argument("--script", required=True, help="Path to voice-script.md")
    parser.add_argument("--markers", help="Path to asset-markers.md (optional)")
    parser.add_argument("--project", default="showcase-60s", help="Project ID")
    parser.add_argument("--speaker", default="opus", help="Speaker ID")
    parser.add_argument("--fps", type=int, default=30, help="FPS")
    parser.add_argument("--output", "-o", required=True, help="Output video-spec.json path")

    # Render-ready upgrade flags
    parser.add_argument("--upgrade-render-ready", action="store_true", help="Upgrade existing spec to render-ready")
    parser.add_argument("--audio", help="Global audio URI (for render-ready)")
    parser.add_argument("--timestamps", help="Path to word_timestamps JSON (from align.py)")
    parser.add_argument("--alignment-source", default="qwen3-fa", help="Alignment source")

    args = parser.parse_args()

    if args.upgrade_render_ready:
        if not args.audio or not args.timestamps:
            print("Error: --upgrade-render-ready requires --audio and --timestamps", file=sys.stderr)
            sys.exit(1)
        existing = json.loads(Path(args.output).read_text(encoding="utf-8"))
        spec = upgrade_to_render_ready(existing, args.audio, args.timestamps, args.alignment_source)
    else:
        script_data = parse_voice_script(args.script)
        print(f"Parsed {len(script_data['segments'])} segments from voice-script.", file=sys.stderr)
        spec = generate_editorial_spec(script_data, args.project, args.speaker, args.fps)

    output = json.dumps(spec, ensure_ascii=False, indent=2)
    Path(args.output).write_text(output, encoding="utf-8")
    print(f"Written {args.output} (status={spec['status']})", file=sys.stderr)


if __name__ == "__main__":
    main()
