import { useEffect, useRef, useState } from "react";

export default function useOtpTimer(seconds = 120) {
  const [left, setLeft] = useState(0);
  const ref = useRef(null);
  const stop = () => { if (ref.current) clearInterval(ref.current); ref.current = null; };
  const start = () => {
    stop(); setLeft(seconds);
    ref.current = setInterval(() => setLeft((s) => { if (s <= 1) { stop(); return 0; } return s - 1; }), 1000);
  };
  useEffect(() => stop, []);
  const text = left > 0 ? `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}` : "Expired";
  return { left, text, start, stop, expired: left === 0 };
}
