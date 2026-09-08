"""Shared by the browser worker and reproducible native OpenCV tests.
OpenCV 4.11.0, non-legacy ChArUco. All lengths supplied to OpenCV are mm.
"""
import json
import cv2
import numpy as np


def make_board(definition):
    dictionary = cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, definition['dictionary']))
    board = cv2.aruco.CharucoBoard(
        (definition['squaresX'], definition['squaresY']),
        definition['squareMm'], definition['markerMm'], dictionary)
    board.setLegacyPattern(definition['legacyPattern'])
    return board


def generate_plate(definition):
    if definition['widthMm'] != definition['squaresX'] * definition['squareMm'] or definition['heightMm'] != definition['squaresY'] * definition['squareMm']:
        raise ValueError('Board dimensions disagree with its square grid.')
    board = make_board(definition)
    # Ten samples/mm: 30 mm squares and 21 mm / 7-cell markers are exact.
    raster = board.generateImage((definition['widthMm'] * 10, definition['heightMm'] * 10), marginSize=0, borderBits=1)
    padded = cv2.copyMakeBorder(raster, 100, 100, 100, 100, cv2.BORDER_CONSTANT, value=255)
    corners, ids, _, _ = cv2.aruco.CharucoDetector(board).detectBoard(padded)
    expected = (definition['squaresX'] - 1) * (definition['squaresY'] - 1)
    if ids is None or len(ids) != expected:
        raise ValueError('Generated board failed detection. Download is disabled.')
    # Lossless vectorization of OpenCV's raster; merge identical consecutive rows.
    rects = []
    y = 0
    while y < raster.shape[0]:
        end = y + 1
        while end < raster.shape[0] and np.array_equal(raster[y], raster[end]):
            end += 1
        edges = np.diff(np.concatenate(([False], raster[y] == 0, [False])).astype(np.int8))
        for start, stop in zip(np.where(edges == 1)[0], np.where(edges == -1)[0]):
            rects.append(f'<rect x="{start/10:g}" y="{y/10:g}" width="{(stop-start)/10:g}" height="{(end-y)/10:g}"/>')
        y = end
    page_w, page_h = definition['pageWidthMm'], definition['pageHeightMm']
    left = (page_w - definition['widthMm']) / 2
    top = (page_h - definition['heightMm']) / 2
    ref = definition['referenceMm']
    ref_left = (page_w - ref) / 2
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{page_w}mm" height="{page_h}mm" viewBox="0 0 {page_w} {page_h}">'
           f'<rect width="{page_w}" height="{page_h}" fill="white"/>'
           '<g font-family="sans-serif" fill="black" font-size="4">'
           f'<text x="15" y="15">Calify · {definition["version"]} · A4</text>'
           f'<text x="15" y="23">{definition["dictionary"]} · {definition["squaresX"]} × {definition["squaresY"]} · square {definition["squareMm"]} mm · marker {definition["markerMm"]} mm</text>'
           f'<text x="15" y="31">Target {definition["widthMm"]} × {definition["heightMm"]} mm · non-legacy · print at 100%</text></g>'
           f'<g transform="translate({left:g} {top:g})" fill="black">' + ''.join(rects) + '</g>'
           f'<path d="M{ref_left:g} 269h{ref} M{ref_left:g} 266v6 M{ref_left+ref:g} 266v6" fill="none" stroke="black" stroke-width="0.3"/>'
           f'<text x="{page_w/2:g}" y="280" text-anchor="middle" font-family="sans-serif" font-size="4">{ref} mm — verify with a ruler</text></svg>')
    return {'svg': svg, 'detectedCorners': len(corners), 'opencv': cv2.__version__}


def detect_image(data, definition):
    image = cv2.imdecode(np.frombuffer(bytes(data), np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('Cannot decode image. Use an uncorrupted JPEG, PNG or WebP.')
    height, width = image.shape[:2]
    if width * height > 24_000_000 or min(width, height) < 480:
        raise ValueError('Use images between 480 pixels on the short side and 24 megapixels. Do not resize only some images.')
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    board = make_board(definition)
    corners, ids, _, _ = cv2.aruco.CharucoDetector(board).detectBoard(gray)
    if ids is None or len(ids) < 12:
        raise ValueError('Fewer than 12 ChArUco corners found. Use the v1 plate, fill more of the frame, remove glare and keep the board visible.')
    if board.checkCharucoCornersCollinear(ids):
        raise ValueError('Corners lie on a line. Show more of the board, including several rows and columns.')
    points = corners.reshape(-1, 2)
    hull = cv2.convexHull(points)
    coverage = float(cv2.contourArea(hull) / (width * height))
    if coverage < 0.025:
        raise ValueError('Board is too small in the frame. Move closer so detected corners cover at least 2.5% of the image.')
    x, y, w, h = cv2.boundingRect(hull)
    sharpness = float(cv2.Laplacian(gray[y:y+h, x:x+w], cv2.CV_64F).var())
    if sharpness < 25:
        raise ValueError('Board looks blurred. Use better light, focus on the board and hold the camera steady.')
    return {'resolution': [width, height], 'corners': points.tolist(), 'ids': ids.reshape(-1).tolist(),
            'coverage': coverage, 'sharpness': sharpness}


def calibrate_views(views, definition):
    if len(views) < 8:
        raise ValueError('At least 8 usable, distinct board images are needed. Aim for 12–20 varied positions and angles.')
    resolution = tuple(views[0]['resolution'])
    if any(tuple(view['resolution']) != resolution for view in views):
        raise ValueError('Mixed image resolutions. Remove incompatible images; use the same camera, lens, zoom and orientation.')
    board = make_board(definition)
    objects, images, signatures = [], [], []
    for view in views:
        ids = np.asarray(view['ids'], dtype=np.int32).reshape(-1, 1)
        corners = np.asarray(view['corners'], dtype=np.float32).reshape(-1, 1, 2)
        if len(ids) < 12 or len(corners) != len(ids) or not np.isfinite(corners).all():
            raise ValueError('Invalid detected points. Remove the image and detect again.')
        obj, img = board.matchImagePoints(corners, ids)
        objects.append(obj)
        images.append(img)
        normalized = corners.reshape(-1, 2) / np.asarray(resolution)
        signatures.append([*normalized.mean(axis=0), float(cv2.contourArea(cv2.convexHull(normalized.astype(np.float32))))])
    signatures = np.asarray(signatures)
    # Basic diversity check; it is not a complete conditioning/coverage guarantee.
    if np.max(np.ptp(signatures[:, :2], axis=0)) < 0.12 and np.ptp(signatures[:, 2]) < 0.05:
        raise ValueError('Views are too similar. Move the board across the frame and change distance and tilt; do not repeat one pose.')
    result = cv2.calibrateCameraExtended(objects, images, resolution, None, None)
    rms, matrix, distortion, _, _, _, _, errors = result
    values = np.concatenate((matrix.ravel(), distortion.ravel(), errors.ravel(), [rms]))
    if not np.isfinite(values).all() or matrix[0, 0] <= 0 or matrix[1, 1] <= 0:
        raise ValueError('Solver produced unstable parameters. Recapture a wider range of board angles and positions.')
    if not (0 <= matrix[0, 2] <= resolution[0] and 0 <= matrix[1, 2] <= resolution[1]) or rms > 2:
        raise ValueError(f'Calibration needs review (RMS {rms:.3f} px). Check print flatness, focus, consistent settings and varied views; replace poor images.')
    return {'resolution': list(resolution), 'cameraMatrix': matrix.tolist(), 'distortion': distortion.ravel().tolist(),
            'rms': float(rms), 'perViewErrors': errors.ravel().tolist(), 'usableImages': len(views)}


def dispatch(payload, definition):
    if payload['action'] == 'plate':
        return generate_plate(definition)
    if payload['action'] == 'detect':
        return detect_image(payload['bytes'], definition)
    if payload['action'] == 'calibrate':
        return calibrate_views(payload['views'], definition)
    raise ValueError('Unknown calibration action.')
