# Casino Lounge Environment

Place assets in this folder to enable fully textured casino lounge rendering.

Expected optional paths:
- `hdri/*.hdr`
- `materials/floor/*.(png|jpg|jpeg|webp)`
- `materials/walls/*.(png|jpg|jpeg|webp)`
- `materials/trim/*.(png|jpg|jpeg|webp)`
- `props/*.(glb|gltf|obj)`

The runtime auto-detects first matching PBR maps by filename tags:
- basecolor/albedo/diffuse/color
- normal
- roughness
- ao

If files are missing, procedural fallback materials are used.
