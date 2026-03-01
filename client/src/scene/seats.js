export const SEATS = [
  {
    id: 0,
    chair: { pos: [0.0, 0.0, 2.85], rotY: Math.PI },
    avatar: { pos: [0.0, 0.0, 2.58], rotY: Math.PI },
    handAnchor: { pos: [0.0, 0.6, 4.45], rotY: 0 },
    nameplateAnchor: { pos: [0.0, 1.82, 3.55] }
  },
  {
    id: 1,
    chair: { pos: [2.85, 0.0, 0.0], rotY: -Math.PI / 2 },
    avatar: { pos: [2.58, 0.0, 0.0], rotY: -Math.PI / 2 },
    handAnchor: { pos: [4.45, 0.6, 0.0], rotY: -Math.PI / 2 },
    nameplateAnchor: { pos: [3.55, 1.82, 0.0] }
  },
  {
    id: 2,
    chair: { pos: [0.0, 0.0, -2.85], rotY: 0 },
    avatar: { pos: [0.0, 0.0, -2.58], rotY: 0 },
    handAnchor: { pos: [0.0, 0.6, -4.45], rotY: Math.PI },
    nameplateAnchor: { pos: [0.0, 1.82, -3.55] }
  },
  {
    id: 3,
    chair: { pos: [-2.85, 0.0, 0.0], rotY: Math.PI / 2 },
    avatar: { pos: [-2.58, 0.0, 0.0], rotY: Math.PI / 2 },
    handAnchor: { pos: [-4.45, 0.6, 0.0], rotY: Math.PI / 2 },
    nameplateAnchor: { pos: [-3.55, 1.82, 0.0] }
  }
];

export function toRelativeSeat(seatIndex, localSeat) {
  if (localSeat == null) return seatIndex;
  return (seatIndex - localSeat + 4) % 4;
}
