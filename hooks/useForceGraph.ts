
import React, { useEffect, useRef, useCallback } from 'react';

export interface GalaxyNode {
    id: string;
    label: string;
    type: 'subject' | 'topic';
    parentId?: string;
    radius: number;
    masteryAll: number; // 0-100 (Domain)
    attempted: number;
    isCritical?: boolean;
    isGold?: boolean; // True if inside Gold Window
    isStarted?: boolean; // True if attempts > 0
}

interface NodePosition {
    x: number;
    y: number;
    r: number;
}

interface Star {
    x: number;
    y: number;
    size: number;
    opacity: number;
    speed: number;
}

// Seed para manter as órbitas consistentes entre renderizações
const getSeed = (str: string) => {
    let h = 0xdeadbeef;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
    return ((h ^ h >>> 16) >>> 0);
};

export const useForceGraph = (
    nodes: GalaxyNode[],
    dimensions: { width: number, height: number },
    onNodeClick: (node: GalaxyNode | null) => void,
    focusedNodeId: string | null,
    isOrbitEnabled: boolean = true,
    expandAll: boolean = false,
    simulationSpeed: number = 1.0 // Novo parâmetro
) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);
    const nodePositions = useRef<Record<string, NodePosition>>({});
    
    // Physics State
    const nodeAngles = useRef<Record<string, number>>({});
    const nodeTilts = useRef<Record<string, number>>({});
    
    // Background State (Stars)
    const starsRef = useRef<Star[]>([]);
    
    // Camera State
    const initialCx = dimensions.width ? dimensions.width / 2 : 0;
    const initialCy = dimensions.height ? dimensions.height / 2 : 0;
    
    const transform = useRef({ x: initialCx, y: initialCy, k: 0.55 }); 
    const targetTransform = useRef({ x: initialCx, y: initialCy, k: 0.55 });
    
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const lastUserGesture = useRef<number>(0); 
    const hasInitialFit = useRef(false);
    
    const lastTimeRef = useRef<number>(0);
    const hoveredNodeId = useRef<string | null>(null);

    // --- LOGIC: VISUAL RULES ---

    const getOrbitRadius = (mastery: number, isMoon: boolean) => {
        // Regra de Negócio: Distância Inversamente Proporcional à Maestria
        const m = Math.max(0, Math.min(100, mastery));
        const inverseFactor = (100 - m) / 100; // 0 (Expert) a 1 (Novato)

        if (isMoon) {
            // Satélites (Tópicos)
            const minR = 40;
            const maxR = 110;
            return minR + (inverseFactor * (maxR - minR));
        } else {
            // Planetas (Disciplinas)
            const minR = 130;
            const maxR = 500;
            return minR + (inverseFactor * (maxR - minR));
        }
    };

    const getAngularVelocity = (node: GalaxyNode) => {
        const GLOBAL_SPEED_MULTIPLIER = 0.6; 
        
        if (!node.isStarted) {
            return 0.05 * GLOBAL_SPEED_MULTIPLIER;
        }

        let speedFactor = 1.0;
        const m = Math.max(0, Math.min(100, node.masteryAll));

        // Maestria Alta = Lento e Estável
        // Maestria Baixa = Rápido e Caótico (Urgente)
        if (m >= 80) {
            speedFactor = 0.4 - ((m - 80) / 20) * 0.2;
        } 
        else if (m >= 40) {
            speedFactor = 0.9 - ((m - 40) / 40) * 0.4;
        } 
        else {
            speedFactor = 1.5 - (m / 40) * 0.5;
        }

        if (node.isGold) {
            speedFactor *= 1.3;
        }

        const typeMultiplier = node.type === 'topic' ? 1.4 : 1.0;

        return speedFactor * typeMultiplier * GLOBAL_SPEED_MULTIPLIER;
    };

    const getDomainColor = (masteryAll: number, attempted: number): string => {
        if (attempted === 0) return '#1e293b'; 
        if (masteryAll < 40) return '#ef4444'; 
        if (masteryAll < 80) return '#eab308';
        return '#22c55e';
    };

    // --- SMART FIT LOGIC ---

    const fitToNodes = useCallback((immediate = false) => {
        if (!dimensions.width || !dimensions.height) return;

        const mainNodes = nodes.filter(n => n.type === 'subject');
        const nodesToFit = mainNodes.length > 0 ? mainNodes : nodes;

        if (nodesToFit.length === 0) return;

        let maxExtent = 0;

        nodesToFit.forEach(node => {
            const orbitR = getOrbitRadius(node.masteryAll, false);
            const safeDistance = orbitR + node.radius + 60; 
            if (safeDistance > maxExtent) maxExtent = safeDistance;
        });

        maxExtent = Math.max(maxExtent, 180);
        const contentDiameter = maxExtent * 2;
        
        const padding = dimensions.width < 768 ? 40 : 80;
        const availableW = dimensions.width - padding;
        const availableH = dimensions.height - padding;

        const scaleX = availableW / contentDiameter;
        const scaleY = availableH / contentDiameter;
        
        let targetScale = Math.min(scaleX, scaleY);
        targetScale = Math.max(0.15, Math.min(1.5, targetScale));

        const newTarget = {
            x: dimensions.width / 2,
            y: dimensions.height / 2,
            k: targetScale
        };

        targetTransform.current = newTarget;

        if (immediate) {
            transform.current = { ...newTarget };
        }
    }, [nodes, dimensions]);

    // --- AUTO-FIT EFFECT ---
    useEffect(() => {
        const timeSinceGesture = Date.now() - lastUserGesture.current;
        const isFreshLoad = !hasInitialFit.current;
        
        if (nodes.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
            if (isFreshLoad || timeSinceGesture > 1500) {
                fitToNodes(isFreshLoad);
                hasInitialFit.current = true;
            }
        }
    }, [nodes.length, dimensions.width, dimensions.height, fitToNodes]);


    // --- INIT STARS ---
    useEffect(() => {
        if (starsRef.current.length === 0) {
            for (let i = 0; i < 600; i++) {
                starsRef.current.push({
                    x: (Math.random() - 0.5) * 4000,
                    y: (Math.random() - 0.5) * 4000,
                    size: Math.random() * 2,
                    opacity: Math.random(),
                    speed: 0.2 + Math.random() * 0.8
                });
            }
        }
    }, []);

    // --- CAMERA CONTROLS ---

    const zoomTo = useCallback((scale: number) => {
        targetTransform.current.k = Math.max(0.1, Math.min(4.0, scale));
        lastUserGesture.current = Date.now();
    }, []);

    const zoomIn = useCallback(() => zoomTo(targetTransform.current.k * 1.3), [zoomTo]);
    const zoomOut = useCallback(() => zoomTo(targetTransform.current.k / 1.3), [zoomTo]);

    const resetView = useCallback(() => {
        fitToNodes(false);
        lastUserGesture.current = 0; 
    }, [fitToNodes]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        lastUserGesture.current = Date.now();
        const zoomIntensity = 0.001;
        const delta = -e.deltaY * zoomIntensity;
        const newScale = Math.min(Math.max(0.1, targetTransform.current.k + delta), 4);
        targetTransform.current.k = newScale;
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        lastUserGesture.current = Date.now();
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging.current) {
            lastUserGesture.current = Date.now();
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            
            targetTransform.current.x += dx;
            targetTransform.current.y += dy;
            
            transform.current.x += dx; 
            transform.current.y += dy;
            
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const mx = (e.clientX - rect.left - transform.current.x) / transform.current.k;
        const my = (e.clientY - rect.top - transform.current.y) / transform.current.k;

        let hit = null;
        const ids = Object.keys(nodePositions.current).reverse();
        
        for (const id of ids) {
            const pos = nodePositions.current[id];
            const dist = Math.hypot(mx - pos.x, my - pos.y);
            if (dist < pos.r + 10) { 
                hit = id;
                break;
            }
        }

        hoveredNodeId.current = hit;
        if (canvasRef.current) {
            canvasRef.current.style.cursor = hit ? 'pointer' : isDragging.current ? 'grabbing' : 'default';
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleCanvasClick = useCallback((e: React.MouseEvent) => {
        if (!hoveredNodeId.current) {
            onNodeClick(null);
            return;
        }
        const node = nodes.find(n => n.id === hoveredNodeId.current) || null;
        onNodeClick(node);
    }, [nodes, onNodeClick]);


    // --- MAIN RENDER LOOP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dpr = window.devicePixelRatio || 1;
        
        if (dimensions.width === 0 || dimensions.height === 0) return;

        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        const tick = (time: number) => {
            const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
            lastTimeRef.current = time;
            
            nodePositions.current = {};

            // 1. Camera Ease
            const ease = 0.08;
            
            if (focusedNodeId && nodePositions.current[focusedNodeId]) {
                const pos = nodePositions.current[focusedNodeId];
                const targetK = 1.6;
                const offsetY = 140; 
                
                targetTransform.current.k = targetK;
                targetTransform.current.x = (dimensions.width / 2) - (pos.x * targetK);
                targetTransform.current.y = (dimensions.height / 2) - (pos.y * targetK) + offsetY;
                
                lastUserGesture.current = Date.now(); 
            }

            transform.current.x += (targetTransform.current.x - transform.current.x) * ease;
            transform.current.y += (targetTransform.current.y - transform.current.y) * ease;
            transform.current.k += (targetTransform.current.k - transform.current.k) * ease;

            if (!Number.isFinite(transform.current.x) || !Number.isFinite(transform.current.y) || !Number.isFinite(transform.current.k)) {
                 transform.current = { x: dimensions.width / 2, y: dimensions.height / 2, k: 0.5 };
                 targetTransform.current = { ...transform.current };
            }

            ctx.clearRect(0, 0, dimensions.width, dimensions.height);
            
            ctx.save();
            ctx.translate(transform.current.x, transform.current.y);
            ctx.scale(transform.current.k, transform.current.k);

            // 2. Background Layers
            const neb1 = ctx.createRadialGradient(-400, -300, 0, -400, -300, 1200);
            neb1.addColorStop(0, 'rgba(14, 165, 233, 0.06)');
            neb1.addColorStop(1, 'transparent');
            ctx.fillStyle = neb1;
            ctx.fillRect(-2000, -2000, 4000, 4000);

            const neb2 = ctx.createRadialGradient(600, 500, 0, 600, 500, 1000);
            neb2.addColorStop(0, 'rgba(220, 38, 38, 0.04)');
            neb2.addColorStop(1, 'transparent');
            ctx.fillStyle = neb2;
            ctx.fillRect(-2000, -2000, 4000, 4000);

            starsRef.current.forEach(star => {
                const pulse = 0.4 + Math.sin(time / 800 * star.speed) * 0.4;
                ctx.globalAlpha = star.opacity * pulse;
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size / Math.pow(transform.current.k, 0.5), 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            // 3. Sun
            const sunRadius = 25;
            ctx.shadowBlur = 60;
            ctx.shadowColor = '#f59e0b';
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, sunRadius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            
            ctx.save();
            ctx.rotate(time / 10000);
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, sunRadius * 1.6, sunRadius * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 4. Planets & Moons
            const ECCENTRICITY = 0.55;
            // Use the passed simulationSpeed multiplier
            const globalSpeed = isOrbitEnabled ? simulationSpeed : 0;
            
            nodes.filter(n => n.type === 'subject').forEach(node => {
                const seed = getSeed(node.id);
                const orbitR = getOrbitRadius(node.masteryAll, false);
                
                if (nodeAngles.current[node.id] === undefined) nodeAngles.current[node.id] = (seed % 1000) / 1000 * Math.PI * 2;
                if (nodeTilts.current[node.id] === undefined) nodeTilts.current[node.id] = ((seed * 73) % 40 - 20) * (Math.PI / 180);

                const direction = node.isCritical ? -1 : 1;
                // getAngularVelocity calculates base speed, multiplied by globalSpeed (which includes simulationSpeed)
                const omega = getAngularVelocity(node) * direction * globalSpeed;
                
                nodeAngles.current[node.id] += omega * dt;

                const angle = nodeAngles.current[node.id];
                const tilt = nodeTilts.current[node.id];
                
                const x_planar = Math.cos(angle) * orbitR;
                const y_planar = Math.sin(angle) * orbitR * ECCENTRICITY;

                const px = x_planar * Math.cos(tilt) - y_planar * Math.sin(tilt);
                const py = x_planar * Math.sin(tilt) + y_planar * Math.cos(tilt);

                if (!Number.isFinite(px) || !Number.isFinite(py)) return;

                nodePositions.current[node.id] = { x: px, y: py, r: node.radius };

                const isHovered = hoveredNodeId.current === node.id;
                const isFocused = focusedNodeId === node.id;
                const baseColor = getDomainColor(node.masteryAll, node.attempted);

                // Orbit Trail
                ctx.strokeStyle = isFocused ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1 / transform.current.k; 
                ctx.setLineDash([6, 6]); 
                ctx.beginPath();
                ctx.ellipse(0, 0, orbitR, orbitR * ECCENTRICITY, tilt, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Moons
                const shouldDrawMoons = isFocused || expandAll || isHovered;
                if (shouldDrawMoons) {
                    const moons = nodes.filter(n => n.type === 'topic' && n.parentId === node.id);
                    moons.forEach((moon, i) => {
                        const mSeed = getSeed(moon.id);
                        
                        const moonDistBase = node.radius + 35 + (i * 12); 
                        const mOrbitR = getOrbitRadius(moon.masteryAll, true);
                        
                        if (nodeAngles.current[moon.id] === undefined) nodeAngles.current[moon.id] = (mSeed % 100) / 100 * Math.PI * 2;
                        
                        const mOmega = getAngularVelocity(moon);
                        nodeAngles.current[moon.id] += mOmega * globalSpeed * dt;
                        
                        const mAngle = nodeAngles.current[moon.id];
                        const mx = px + Math.cos(mAngle) * mOrbitR;
                        const my = py + Math.sin(mAngle) * mOrbitR * ECCENTRICITY; 
                        
                        nodePositions.current[moon.id] = { x: mx, y: my, r: moon.radius };

                        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                        ctx.beginPath(); 
                        ctx.ellipse(px, py, mOrbitR, mOrbitR * ECCENTRICITY, 0, 0, Math.PI*2);
                        ctx.stroke();

                        const mColor = getDomainColor(moon.masteryAll, moon.attempted);
                        ctx.fillStyle = mColor;
                        if (hoveredNodeId.current === moon.id) {
                            ctx.shadowBlur = 10; ctx.shadowColor = mColor;
                        }
                        ctx.beginPath(); ctx.arc(mx, my, moon.radius, 0, Math.PI*2); ctx.fill();
                        ctx.shadowBlur = 0;
                        
                        if (transform.current.k > 1.5 || expandAll) {
                            ctx.fillStyle = 'rgba(255,255,255,0.7)';
                            ctx.font = `${8 / Math.pow(transform.current.k, 0.2)}px "Plus Jakarta Sans"`;
                            ctx.fillText(moon.label, mx, my + moon.radius + 8);
                        }
                    });
                }

                // Planet Body
                const r = isFocused || isHovered ? node.radius * 1.15 : node.radius;
                
                const grad = ctx.createRadialGradient(
                    px - r * 0.3, 
                    py - r * 0.3, 
                    0, 
                    px, 
                    py, 
                    r
                );
                
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); 
                grad.addColorStop(0.2, baseColor);
                grad.addColorStop(0.8, baseColor); 
                grad.addColorStop(1, '#000000'); 

                ctx.fillStyle = grad;
                
                if (isFocused || isHovered) {
                    ctx.shadowBlur = 40;
                    ctx.shadowColor = baseColor;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(px, py, r + 4, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Planet Label
                if (isHovered || isFocused || transform.current.k > 0.3 || expandAll) {
                    const fontSize = (isFocused ? 14 : 11) / Math.pow(transform.current.k, 0.2); 
                    ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
                    ctx.textAlign = 'center';
                    
                    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
                    ctx.fillStyle = 'white';
                    ctx.fillText(node.label.toUpperCase(), px, py + r + (18/transform.current.k));
                    
                    if (isHovered || isFocused) {
                        ctx.fillStyle = baseColor;
                        ctx.font = `bold ${fontSize * 0.9}px monospace`;
                        const status = node.isStarted ? `${node.masteryAll.toFixed(0)}%` : 'NOVO';
                        ctx.fillText(status, px, py + r + (32/transform.current.k));
                    }
                    ctx.shadowBlur = 0;
                }
            });

            ctx.restore();
            requestRef.current = requestAnimationFrame(tick);
        };

        requestRef.current = requestAnimationFrame(tick);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [dimensions, nodes, focusedNodeId, isOrbitEnabled, expandAll, simulationSpeed]);

    return { 
        canvasRef,
        handleCanvasClick,
        handleMouseMove,
        handleMouseDown,
        handleMouseUp,
        handleWheel,
        zoomIn,
        zoomOut,
        resetView 
    };
};
