"""Usage: python scripts/generate-plate.py > /tmp/calify-charuco-v1-a4.svg"""
import importlib.util
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('engine', root / 'public/calibration/engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
print(engine.generate_plate(json.loads((root / 'public/calibration/board.json').read_text()))['svg'])
