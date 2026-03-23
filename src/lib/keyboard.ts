"use client";

import { useEffect, useState } from "react";

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const onResize = () => {
      const height = window.innerHeight - viewport.height;
      setKeyboardHeight(height > 100 ? height : 0);
      document.documentElement.style.setProperty(
        "--keyboard-height",
        `${height > 100 ? height : 0}px`,
      );
    };

    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  return keyboardHeight;
}
