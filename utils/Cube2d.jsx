import React, { useRef, useEffect, useState } from 'react';

const COLOR_MAP = {
  W: '#FFFFFF',
  Y: '#FFD400',
  R: '#D32F2F',
  O: '#FF8F00',
  B: '#1976D2',
  G: '#388E3C',
};

// Layout definitions defining where each face goes (row, col)
const LAYOUTS = {

  standard: {
    cols: 4,
    rows: 3,
    positions: { U: [1, 2], L: [2, 1], F: [2, 2], R: [2, 3], B: [2, 4], D: [3, 2] }
  },

  compact: {
    cols: 3,
    rows: 3,
    positions: { U: [1, 2], L: [2, 1], F: [2, 2], R: [2, 3], B: [3, 3], D: [3, 2] }
  },
  // Vertical Stack (Best for sidebars/narrow areas)
  // L U
  // F R
  // D B
  vertical: {
    cols: 2,
    rows: 3,
    positions: { L: [1, 1], U: [1, 2], F: [2, 1], R: [2, 2], D: [3, 1], B: [3, 2] }
  }
};

function Face({ face, stickerSize, gap, stickerRadius, flatPadding }) {
  const N = Array.isArray(face) ? face.length : 0;
  const items = Array.isArray(face) ? face.flat() : [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(N, 1)}, ${stickerSize}px)`,
        gridAutoRows: `${stickerSize}px`,
        gap: `${gap}px`,
        padding: `${flatPadding}px`,
        boxSizing: 'border-box',
        justifyContent: 'center', 
        alignContent: 'center',
        height: '100%',
        width: '100%'
      }}
    >
      {items.map((color, i) => (
        <div
          key={i}
          style={{
            width: stickerSize,
            height: stickerSize,
            backgroundColor: COLOR_MAP[color] || '#888888',
            border: '1px solid rgba(0,0,0,0.35)',
            borderRadius: `${stickerRadius}px`,
            boxShadow: stickerSize < 8 ? 'none' : 'inset 0 0 4px rgba(0,0,0,0.18)',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}

export default function Cube2d({ cube = {}, maxStickerSize = 40, padding = 8 }) {
  const containerRef = useRef(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };
    
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // Safe access to N
  const N = (Array.isArray(cube?.U) && cube.U.length) ? cube.U.length :
            (Array.isArray(cube?.F) && cube.F.length) ? cube.F.length : 3;

  // --- Dynamic Layout Calculation ---
  
  const availW = Math.max(bounds.width - padding * 2, 0);
  const availH = Math.max(bounds.height - padding * 2, 0);

  // 2. Optimization settings for large cubes (6x6, 7x7)
  // If N is large, we reduce gaps to absolute minimum to favor sticker size
  const isLargeCube = N >= 5;
  const outerGap = isLargeCube ? 2 : 6;
  const facePadding = isLargeCube ? 0 : 4; 
  
  // 3. Evaluate all layouts to find the one that yields the largest faceSize
  let bestLayoutName = 'standard';
  let bestFaceSize = 0;

  Object.entries(LAYOUTS).forEach(([name, config]) => {
    // Calculate how much space is consumed by gaps for this specific layout
    const gapW = outerGap * (config.cols - 1);
    const gapH = outerGap * (config.rows - 1);

    // Calculate max possible face size for this layout within bounds
    const rawFaceW = (availW - gapW) / config.cols;
    const rawFaceH = (availH - gapH) / config.rows;
    
    const size = Math.floor(Math.min(rawFaceW, rawFaceH));
    
    if (size > bestFaceSize) {
      bestFaceSize = size;
      bestLayoutName = name;
    }
  });

  // 4. Fallback if container is hidden or 0 size
  let faceSize = bestFaceSize > 0 ? bestFaceSize : 100;
  const layout = LAYOUTS[bestLayoutName];

  // 5. Calculate Sticker Size based on Face Size
  // For large cubes, use a tiny fixed gap (1px) or percentage
  const stickerGap = isLargeCube ? 1 : Math.max(2, Math.round(faceSize * 0.03));
  
  let stickerSize = Math.floor((faceSize - 2 * facePadding - stickerGap * (N - 1)) / N);

  // Cap size
  if (stickerSize > maxStickerSize) {
    stickerSize = maxStickerSize;
    // Recalculate face size to shrink-wrap
    faceSize = stickerSize * N + 2 * facePadding + stickerGap * (N - 1);
  }
  
  // Floor check
  if (stickerSize < 2) stickerSize = 2;

  // Radius check (squares for tiny stickers look better)
  const stickerRadius = stickerSize < 6 ? 0 : isLargeCube ? 1 : 2;

  // --- Render ---

  // Net Style
  const netStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.cols}, ${faceSize}px)`,
    gridTemplateRows: `repeat(${layout.rows}, ${faceSize}px)`,
    gap: `${outerGap}px`,
    padding: `${padding}px`,
    boxSizing: 'border-box',
    // Make the background subtle or transparent
    backgroundColor: 'transparent', 
    width: 'auto',
    height: 'auto',
  };

  // Helper to place a face
  const renderFace = (faceData, faceName) => {
    const pos = layout.positions[faceName];
    if (!pos) return null; // Should not happen
    
    // Normalize data
    const data = (Array.isArray(faceData) ? faceData : Array.from({ length: N }, () => Array.from({ length: N }, () => '8'))); // '8' is gray fallback

    return (
      <div style={{ gridRow: `${pos[0]} / ${pos[0] + 1}`, gridColumn: `${pos[1]} / ${pos[1] + 1}` }}>
        <Face 
          face={data} 
          stickerSize={stickerSize} 
          gap={stickerGap} 
          stickerRadius={stickerRadius} 
          flatPadding={facePadding}
        />
      </div>
    );
  };

  const { U, L, F, R, B, D } = cube || {};

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={netStyle}>
        {renderFace(U, 'U')}
        {renderFace(L, 'L')}
        {renderFace(F, 'F')}
        {renderFace(R, 'R')}
        {renderFace(B, 'B')}
        {renderFace(D, 'D')}
      </div>
    </div>
  );
}