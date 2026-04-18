import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface TypewriterProps {
  words: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseTime?: number;
  className?: string;
  highlightClass?: string;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  words,
  typingSpeed = 150,
  deletingSpeed = 100,
  pauseTime = 2000,
  className = "",
  highlightClass = "text-indigo-600"
}) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) {
      const timer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, pauseTime);
      return () => clearTimeout(timer);
    }

    if (isDeleting && subIndex === 0) {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    if (!isDeleting && subIndex === words[index].length) {
      setIsPaused(true);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [subIndex, index, isDeleting, isPaused, words, typingSpeed, deletingSpeed, pauseTime]);

  return (
    <span className={cn("relative inline-flex items-center whitespace-nowrap", className)}>
      {/* Reserve space for the longest word to prevent layout shift (shaking) */}
      <span className="invisible h-auto select-none pointer-events-none pr-2" aria-hidden="true">
        {words.reduce((a, b) => a.length > b.length ? a : b)}
      </span>
      
      <span className="absolute left-0 top-0 bottom-0 flex items-center">
        <span className={cn(highlightClass, "inline-block pr-2 leading-none cursor-default")}>
          {words[index].substring(0, subIndex)}
        </span>
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          className="inline-block w-[4px] bg-slate-900 align-middle shrink-0"
          style={{ height: '0.8em' }}
        />
      </span>
    </span>
  );
};
