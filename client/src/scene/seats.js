export const SEATS = [
  {
    id: 0,
    chair: { pos: [0.0, 0.0, 2.4], rotY: Math.PI },
    avatar: { pos: [0.0, 0.0, 2.15], rotY: Math.PI },
    handAnchor: { pos: [0.0, 0.6, 3.85], rotY: 0 },
    nameplateAnchor: { pos: [0.0, 1.75, 3.0] }
  },
  {
    id: 1,
    chair: { pos: [2.4, 0.0, 0.0], rotY: -Math.PI / 2 },
    avatar: { pos: [2.15, 0.0, 0.0], rotY: -Math.PI / 2 },
    handAnchor: { pos: [3.85, 0.6, 0.0], rotY: -Math.PI / 2 },
    nameplateAnchor: { pos: [3.0, 1.75, 0.0] }
  },
  {
    id: 2,
    chair: { pos: [0.0, 0.0, -2.4], rotY: 0 },
    avatar: { pos: [0.0, 0.0, -2.15], rotY: 0 },
    handAnchor: { pos: [0.0, 0.6, -3.85], rotY: Math.PI },
    nameplateAnchor: { pos: [0.0, 1.75, -3.0] }
  },
  {
    id: 3,
    chair: { pos: [-2.4, 0.0, 0.0], rotY: Math.PI / 2 },
    avatar: { pos: [-2.15, 0.0, 0.0], rotY: Math.PI / 2 },
    handAnchor: { pos: [-3.85, 0.6, 0.0], rotY: Math.PI / 2 },
    nameplateAnchor: { pos: [-3.0, 1.75, 0.0] }
  }
];

export function toRelativeSeat(seatIndex, localSeat) {
  if (localSeat == null) return seatIndex;
  return (seatIndex - localSeat + 4) % 4;
}
