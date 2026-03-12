import subprocess
import json
import logging

logger = logging.getLogger(__name__)

def analyze_media_file(file_path: str) -> dict:
    """Use ffprobe to extract media metadata."""
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            logger.warning(f"ffprobe failed for {file_path}: {result.stderr}")
            return {}

        data = json.loads(result.stdout)
        format_data = data.get('format', {})
        video_stream = next(
            (s for s in data.get('streams', []) if s.get('codec_type') == 'video'), {}
        )

        duration = float(format_data.get('duration', 0))
        width = video_stream.get('width', 0)
        height = video_stream.get('height', 0)
        fps_str = video_stream.get('r_frame_rate', '30/1')

        fps_parts = fps_str.split('/')
        fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 and float(fps_parts[1]) > 0 else 30.0

        # Determine quality label
        if height >= 2160:
            quality = "4K60" if fps >= 50 else "4K"
        elif height >= 1440:
            quality = "1440p60" if fps >= 50 else "1440p"
        elif height >= 1080:
            quality = "1080p60" if fps >= 50 else "1080p"
        elif height >= 720:
            quality = "720p60" if fps >= 50 else "720p"
        elif height > 0:
            quality = f"{height}p"
        else:
            quality = "Unknown"

        # Format duration
        total_seconds = int(duration)
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60

        if hours > 0:
            duration_formatted = f"{hours}:{minutes:02d}:{seconds:02d}"
        else:
            duration_formatted = f"{minutes}:{seconds:02d}"

        duration_minutes = max(1, round(duration / 60))
        file_size = int(format_data.get('size', 0))

        return {
            'duration_seconds': duration,
            'duration_formatted': duration_formatted,
            'duration_minutes': duration_minutes,
            'resolution': f"{width}x{height}" if width and height else None,
            'fps': round(fps, 2),
            'quality_label': quality,
            'file_size': file_size,
        }
    except Exception as e:
        logger.error(f"Error analyzing media file {file_path}: {e}")
        return {}


def is_ffmpeg_available() -> bool:
    try:
        result = subprocess.run(['ffprobe', '-version'], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False
