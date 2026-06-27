import React, { useState, useRef } from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  maxRotation?: number; // Maximum rotation in degrees
}

export default function ThreeDCard({
  children,
  style = {},
  className = '',
  onClick,
  maxRotation = 8,
  ...props
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [shadow, setShadow] = useState('var(--shadow-sm)');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; 
    const y = e.clientY - rect.top;  
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation: cursor to the right (positive X) rotates card around Y axis (positive rotateY)
    // Cursor to the bottom (positive Y) rotates card around X axis (negative rotateX)
    const rotateX = ((centerY - y) / centerY) * maxRotation;
    const rotateY = ((x - centerX) / centerX) * maxRotation;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`);

    // Cast a subtle neon shadow in the opposite direction of the cursor
    const shadowX = -((x - centerX) / centerX) * 8;
    const shadowY = -((y - centerY) / centerY) * 8;
    setShadow(`${shadowX}px ${shadowY}px 24px rgba(0, 245, 255, 0.1)`);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
    setShadow('var(--shadow-sm)');
  };

  return (
    <div
      ref={cardRef}
      className={`${className} perspective-3d`}
      style={{
        ...style,
        transform,
        boxShadow: shadow,
        transition: 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.15s ease',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}
