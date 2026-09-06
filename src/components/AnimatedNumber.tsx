import { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  severity?: "NORMAL" | "WARNING" | "CRITICAL";
  isInteger?: boolean;
}

export function AnimatedNumber({ value, className = "", severity = "NORMAL", isInteger = false }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);
  
  // Reduced motion check
  const prefersReducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    if (value !== prevValueRef.current) {
      if (prefersReducedMotion.current) {
        setDisplayValue(value);
        prevValueRef.current = value;
        return;
      }

      // Flash effect
      setIsFlashing(true);
      const flashTimeout = setTimeout(() => setIsFlashing(false), 400);

      const startValue = prevValueRef.current;
      const endValue = value;
      const duration = 500;
      let startTime: number | null = null;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = startValue + (endValue - startValue) * ease;
        
        setDisplayValue(current);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
        }
      };

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
      
      prevValueRef.current = value;

      return () => {
        clearTimeout(flashTimeout);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [value]);

  let baseColorClass = "text-white";
  if (severity === "CRITICAL") baseColorClass = "text-red-500";
  else if (severity === "WARNING") baseColorClass = "text-amber-500";

  let flashClass = "";
  if (isFlashing) {
    if (severity === "CRITICAL") flashClass = "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-105";
    else if (severity === "WARNING") flashClass = "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] scale-105";
    else flashClass = "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-105";
  }

  return (
    <span 
      className={`inline-block transition-all duration-300 ${baseColorClass} ${isFlashing ? flashClass : ""} ${className}`}
    >
      {isInteger ? Math.round(displayValue) : displayValue.toFixed(2)}
    </span>
  );
}
