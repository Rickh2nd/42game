export const SEATS = [
  {
    id: 0,
    chair: { pos: [0, 0, 2.2], rotY: Math.PI },
    avatar: { pos: [0, 0.37, 2.04], rotY: Math.PI },
    handAnchor: { pos: [0, 0.6, 3.82], rotY: 0 },
    nameplateAnchor: { x: 50, y: 95 }
  },
  {
    id: 1,
    chair: { pos: [2.2, 0, 0], rotY: -Math.PI / 2 },
    avatar: { pos: [2.04, 0.37, 0], rotY: -Math.PI / 2 },
    handAnchor: { pos: [3.84, 0.6, 0], rotY: -Math.PI / 2 },
    nameplateAnchor: { x: 95, y: 50 }
  },
  {
    id: 2,
    chair: { pos: [0, 0, -2.2], rotY: 0 },
    avatar: { pos: [0, 0.37, -2.04], rotY: 0 },
    handAnchor: { pos: [0, 0.6, -3.82], rotY: Math.PI },
    nameplateAnchor: { x: 50, y: 5 }
  },
  {
    id: 3,
    chair: { pos: [-2.2, 0, 0], rotY: Math.PI / 2 },
    avatar: { pos: [-2.04, 0.37, 0], rotY: Math.PI / 2 },
    handAnchor: { pos: [-3.84, 0.6, 0], rotY: Math.PI / 2 },
    nameplateAnchor: { x: 5, y: 50 }
  }
];

export function toRelativeSeat(seatIndex, localSeat) {
  if (localSeat == null) return seatIndex;
  return (seatIndex - localSeat + 4) % 4;
}
