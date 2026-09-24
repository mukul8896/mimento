/**
 * Hearts, stars and balloons drifting up behind the hero. Pure CSS (see .wr-floater); fixed
 * positions so server and client render the same markup.
 */
const FLOATERS = [
  ['💖', 6, 14, 0],
  ['🎈', 18, 18, 3],
  ['✨', 30, 11, 6],
  ['🎁', 44, 20, 1],
  ['💫', 57, 13, 8],
  ['🎉', 68, 17, 4],
  ['💝', 80, 15, 10],
  ['⭐', 91, 12, 2],
  ['🪔', 12, 22, 12],
  ['🌸', 74, 21, 14],
] as const;

export function FloatingBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {FLOATERS.map(([emoji, left, duration, delay], i) => (
        <span
          key={i}
          className="wr-floater text-2xl sm:text-3xl"
          style={{
            left: `${left}%`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
