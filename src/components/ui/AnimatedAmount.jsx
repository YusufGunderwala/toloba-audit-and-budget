import { useLayoutEffect, useRef, useState } from 'react';

const DURATION_MS = 650;
const amountFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export default function AnimatedAmount({ amount }) {
  const target = Math.round(amount * 100);
  const [displayed, setDisplayed] = useState(0);
  const current = useRef(0);

  useLayoutEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame;
    let startedAt;
    const from = current.current;

    const show = value => {
      current.current = value;
      setDisplayed(value);
    };

    if (motion.matches || from === target) {
      show(target);
      return;
    }

    const animate = time => {
      startedAt ??= time;
      const progress = Math.min((time - startedAt) / DURATION_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      show(progress === 1 ? target : Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    const handleMotionChange = event => {
      if (event.matches) {
        cancelAnimationFrame(frame);
        show(target);
      }
    };

    motion.addEventListener('change', handleMotionChange);
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', handleMotionChange);
    };
  }, [target]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">₹{amountFormatter.format((displayed || 0) / 100)}</span>
      <span className="sr-only">₹{amountFormatter.format(target / 100)}</span>
    </>
  );
}
