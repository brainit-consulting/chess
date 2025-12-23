import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PIECE_TYPES = ["king", "queen", "rook", "bishop", "knight", "pawn"]


def main() -> None:
    args = parse_args()
    blend_path = Path(args.input_path).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if blend_path.exists():
        bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    else:
        raise FileNotFoundError(f"Blend file not found: {blend_path}")

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    if hasattr(scene.unit_settings, "length_unit"):
        scene.unit_settings.length_unit = "METERS"

    piece_objects = find_piece_objects()
    if not any(piece_objects.values()):
        raise RuntimeError("No chess piece objects found. Check naming or collections.")

    for piece_type in PIECE_TYPES:
        objects = piece_objects.get(piece_type, [])
        if not objects:
            print(f"[warn] Missing {piece_type}, skipping export.")
            continue

        export_piece(objects, output_dir / f"{piece_type}.glb")

    write_manifest(output_dir)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        dest="input_path",
        default="H:/chess/public/assets/chess/standard/chess-standard-pieces.blend",
    )
    parser.add_argument(
        "--output",
        dest="output_dir",
        default="H:/chess/public/assets/chess/standard/glb",
    )
    return parser.parse_args(sys_argv_after_double_dash())


def sys_argv_after_double_dash() -> list[str]:
    argv = []
    if "--" in sys.argv:
        argv = sys.argv[sys.argv.index("--") + 1 :]
    return argv


def find_piece_objects() -> dict[str, list[bpy.types.Object]]:
    # Assumption: mesh objects or collections include piece keywords (e.g. "White_King").
    candidates: dict[str, list[bpy.types.Object]] = {piece: [] for piece in PIECE_TYPES}

    def add_candidate(piece: str, obj: bpy.types.Object) -> None:
        if obj.type != "MESH":
            return
        if obj not in candidates[piece]:
            candidates[piece].append(obj)

    for collection in bpy.data.collections:
        name = collection.name.lower()
        for piece in PIECE_TYPES:
            if piece in name:
                for obj in collection.objects:
                    add_candidate(piece, obj)

    for obj in bpy.data.objects:
        name = obj.name.lower()
        for piece in PIECE_TYPES:
            if piece in name:
                add_candidate(piece, obj)

    return candidates


def export_piece(objects: list[bpy.types.Object], output_path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    set_origin_to_base_center(objects)
    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Export selection only, preserving object names for prefab mapping.
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )


def set_origin_to_base_center(objects: list[bpy.types.Object]) -> None:
    # Move origin to the base center using combined bounds in world space.
    all_corners: list[Vector] = []
    for obj in objects:
        all_corners.extend([obj.matrix_world @ Vector(corner) for corner in obj.bound_box])
    min_z = min(corner.z for corner in all_corners)
    center_x = (min(corner.x for corner in all_corners) + max(corner.x for corner in all_corners)) / 2
    center_y = (min(corner.y for corner in all_corners) + max(corner.y for corner in all_corners)) / 2
    cursor = bpy.context.scene.cursor
    cursor.location = Vector((center_x, center_y, min_z))


def write_manifest(output_dir: Path) -> None:
    manifest_path = output_dir / "manifest.json"
    lines = ["{"] + [
        f'  "{piece}": "{piece}.glb"{"," if idx < len(PIECE_TYPES) - 1 else ""}'
        for idx, piece in enumerate(PIECE_TYPES)
    ]
    lines.append("}")
    manifest_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
