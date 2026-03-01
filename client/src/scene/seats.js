export const SEATS = [
  {
    id: 0,
    chair: { pos: [0.0, 0.0, 3.12], rotY: Math.PI },
    avatar: { pos: [0.0, 0.0, 2.94], rotY: Math.PI },
    handAnchor: { pos: [0.0, 0.66, 4.88], rotY: 0 },
    nameplateAnchor: { pos: [0.0, 1.84, 3.86] },
    camera: { pos: [0.22, 1.24, 5.58], lookAt: [0.0, 0.78, 0.0] }
  },
  {
    id: 1,
    chair: { pos: [3.12, 0.0, 0.0], rotY: -Math.PI / 2 },
    avatar: { pos: [2.94, 0.0, 0.0], rotY: -Math.PI / 2 },
    handAnchor: { pos: [4.88, 0.66, 0.0], rotY: -Math.PI / 2 },
    nameplateAnchor: { pos: [3.86, 1.84, 0.0] },
    camera: { pos: [5.58, 1.24, -0.22], lookAt: [0.0, 0.78, 0.0] }
  },
  {
    id: 2,
    chair: { pos: [0.0, 0.0, -3.12], rotY: 0 },
    avatar: { pos: [0.0, 0.0, -2.94], rotY: 0 },
    handAnchor: { pos: [0.0, 0.66, -4.88], rotY: Math.PI },
    nameplateAnchor: { pos: [0.0, 1.84, -3.86] },
    camera: { pos: [-0.22, 1.24, -5.58], lookAt: [0.0, 0.78, 0.0] }
  },
  {
    id: 3,
    chair: { pos: [-3.12, 0.0, 0.0], rotY: Math.PI / 2 },
    avatar: { pos: [-2.94, 0.0, 0.0], rotY: Math.PI / 2 },
    handAnchor: { pos: [-4.88, 0.66, 0.0], rotY: Math.PI / 2 },
    nameplateAnchor: { pos: [-3.86, 1.84, 0.0] },
    camera: { pos: [-5.58, 1.24, 0.22], lookAt: [0.0, 0.78, 0.0] }
  }
];

export function toRelativeSeat(seatIndex, localSeat) {
  if (localSeat == null) return seatIndex;
  return (seatIndex - localSeat + 4) % 4;
}
