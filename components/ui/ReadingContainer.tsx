
import React from 'react';

interface ReadingContainerProps {
    children: React.ReactNode;
    mode: 'compact' | 'fullscreen' | undefined;
    className?: string;
}

const ReadingContainer: React.FC<ReadingContainerProps> = ({ children, mode = 'compact', className = '' }) => {
    // Mode Logic:
    // Compact: Limits width on larger screens (Tablet/Desktop), centers content.
    // Fullscreen: Uses full available width (standard behavior).
    // On Mobile (xs/sm), it always behaves like full width with some padding, regardless of mode.
    
    // Updated max-width to ~980px (using max-w-[980px] custom class or closest Tailwind default)
    // max-w-5xl is 64rem = 1024px. max-w-4xl is 56rem = 896px. 
    // The requirement is ~980px. max-w-[980px] is precise.
    const containerClasses = mode === 'compact' 
        ? 'max-w-[980px] mx-auto w-full transition-[max-width] duration-300' 
        : 'w-full px-0 md:px-4 transition-[max-width] duration-300';

    // Padding Logic:
    // We add standard padding here to ensure text doesn't touch edges, 
    // but allow className prop to override or add if needed.
    
    return (
        <div className={`${containerClasses} ${className}`}>
            {children}
        </div>
    );
};

export default ReadingContainer;
