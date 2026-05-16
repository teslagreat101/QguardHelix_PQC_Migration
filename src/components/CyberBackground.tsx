import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const CyberBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Particles (Quantum particle effects)
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 15;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.008,
      color: 0x00D9FF,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    camera.position.z = 5;

    const animate = () => {
      requestAnimationFrame(animate);
      particlesMesh.rotation.y += 0.0005;
      particlesMesh.rotation.x += 0.0002;
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      {/* 1. Deep gradient backdrop */}
      <div className="fixed inset-0 -z-50 bg-[#070B1A] bg-gradient-to-br from-[#070B1A] via-[#0B1023] to-[#11182D]" />
      
      {/* 2. Soft radial golden glows & Light fog / volumetric glow */}
      <div className="fixed inset-0 -z-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-[radial-gradient(ellipse_at_center,rgba(212,169,58,0.12)_0%,transparent_60%)] blur-[90px]" />
        <div className="absolute top-[20%] right-[-15%] w-[70%] h-[70%] bg-[radial-gradient(ellipse_at_center,rgba(0,217,255,0.06)_0%,transparent_50%)] blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[80%] h-[80%] bg-[radial-gradient(ellipse_at_center,rgba(240,193,91,0.08)_0%,transparent_60%)] blur-[120px]" />
      </div>

      {/* 3. Transparent hexagonal overlays */}
      <div 
        className="fixed inset-0 -z-30 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='103.923' viewBox='0 0 60 103.923' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15L30 0zm0 103.923l25.98-15v-30L30 43.923l-25.98 15v30L30 103.923zM0 77.923l0-30L-25.98 32.923v-30L0 17.923l25.98-15v-30L0-42.077l-25.98 15v30L0 -2.077z' fill='%23101A33' fill-opacity='0.5' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 103.923px'
        }}
      />

      {/* 4. Subtle animated grid lines */}
      <div className="fixed inset-0 -z-20 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0, 217, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 217, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, black 30%, transparent 80%)' }} />

      {/* 8. Thin holographic UI lines & Soft moving light beams */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute left-[5%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#00D9FF] to-transparent opacity-20" />
        <div className="absolute right-[5%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#D4A93A] to-transparent opacity-20" />
      </div>

      {/* 5. Quantum particle effects (WebGL layer) */}
      <div ref={containerRef} className="fixed inset-0 -z-10 pointer-events-none opacity-50 mix-blend-screen" />
    </>
  );
};
