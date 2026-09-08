"""Reproducible synthetic known-intrinsics dataset; no real-world accuracy claim."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('engine', ROOT / 'public/calibration/engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
BOARD = json.loads((ROOT / 'public/calibration/board.json').read_text())


def synthetic_views():
    """Render all board pixels at 12 known poses with an ideal pinhole camera."""
    board = engine.make_board(BOARD)
    texture = board.generateImage((1500, 2100), marginSize=0, borderBits=1)
    camera = np.array([[1050., 0., 640.], [0., 1030., 480.], [0., 0., 1.]])
    obj = np.array([[0.,0.,0.],[150.,0.,0.],[150.,210.,0.],[0.,210.,0.]], np.float32)
    src = np.array([[0.,0.],[1500.,0.],[1500.,2100.],[0.,2100.]], np.float32)
    views, images = [], []
    for i in range(12):
        rotation = np.array([(-0.35,0.15,0.4)[i % 3], (-0.4,0.2,0.35,0.0)[i % 4], (i % 3 - 1) * .12])
        translation = np.array([-120. + (i % 4) * 28, -130. + (i % 3) * 25, 450. + (i % 3) * 55])
        points, _ = cv2.projectPoints(obj, rotation, translation, camera, np.zeros(5))
        transform = cv2.getPerspectiveTransform(src, points.reshape(4,2))
        image = cv2.warpPerspective(texture, transform, (1280,960), flags=cv2.INTER_LINEAR, borderValue=255)
        encoded = cv2.imencode('.png', image)[1].tobytes()
        views.append(engine.detect_image(encoded, BOARD))
        images.append(encoded)
    return camera, views, images


class CalibrationTests(unittest.TestCase):
    def test_generated_plate(self):
        plate = engine.generate_plate(BOARD)
        self.assertEqual(plate['detectedCorners'], 24)
        import xml.etree.ElementTree as ET
        root = ET.fromstring(plate['svg'])
        self.assertEqual(root.attrib['width'], '210mm')
        self.assertEqual(root.attrib['height'], '297mm')
        # Independently reconstruct the SVG target rectangles and detect the download.
        raster = np.full((2970,2100), 255, np.uint8)
        group = next(g for g in root if g.attrib.get('transform') == 'translate(30 43.5)')
        for rect in group:
            x = round((30 + float(rect.attrib['x'])) * 10)
            y = round((43.5 + float(rect.attrib['y'])) * 10)
            w = round(float(rect.attrib['width']) * 10)
            h = round(float(rect.attrib['height']) * 10)
            raster[y:y+h, x:x+w] = 0
        detected = engine.detect_image(cv2.imencode('.png', raster)[1].tobytes(), BOARD)
        self.assertEqual(len(detected['ids']), 24)

    def test_failures(self):
        with self.assertRaisesRegex(ValueError, 'decode'):
            engine.detect_image(b'not an image', BOARD)
        blank = cv2.imencode('.png', np.full((960,1280),255,np.uint8))[1].tobytes()
        with self.assertRaisesRegex(ValueError, 'Fewer than 12'):
            engine.detect_image(blank, BOARD)
        with self.assertRaisesRegex(ValueError, 'At least 8'):
            engine.calibrate_views([], BOARD)

    def test_known_camera(self):
        camera, views, images = synthetic_views()
        result = engine.calibrate_views(views, BOARD)
        fitted = np.array(result['cameraMatrix'])
        self.assertLess(result['rms'], 1.0)
        np.testing.assert_allclose([fitted[0,0], fitted[1,1]], [camera[0,0], camera[1,1]], rtol=.04)
        np.testing.assert_allclose([fitted[0,2], fitted[1,2]], [camera[0,2], camera[1,2]], atol=15)
        self.assertEqual(len(result['perViewErrors']), 12)
        with patch.object(cv2, 'calibrateCameraExtended', return_value=(3.0, camera, np.zeros(5), [], [], [], [], np.ones((12,1)))):
            with self.assertRaisesRegex(ValueError, 'needs review'):
                engine.calibrate_views(views, BOARD)
        with patch.object(cv2, 'calibrateCameraExtended', return_value=(float('nan'), camera, np.zeros(5), [], [], [], [], np.ones((12,1)))):
            with self.assertRaisesRegex(ValueError, 'unstable parameters'):
                engine.calibrate_views(views, BOARD)
        print('\nSynthetic camera validation:', json.dumps(result))
        # Export only on request, so tests do not dirty the repository.
        import os
        if os.environ.get('CALIFY_TEST_ARTIFACTS'):
            output = Path(os.environ['CALIFY_TEST_ARTIFACTS'])
            output.mkdir(parents=True, exist_ok=True)
            for i, image in enumerate(images):
                (output / f'view-{i:02d}.png').write_bytes(image)
            (output / 'result.json').write_text(json.dumps({'knownCameraMatrix':camera.tolist(),'result':result}, indent=2))
        with self.assertRaisesRegex(ValueError, 'too similar'):
            engine.calibrate_views([views[0]] * 8, BOARD)
        mixed = [dict(v) for v in views]
        mixed[-1]['resolution'] = [640,480]
        with self.assertRaisesRegex(ValueError, 'Mixed image'):
            engine.calibrate_views(mixed, BOARD)


if __name__ == '__main__':
    unittest.main()
