import * as THREE from 'three';

export function createExplosions(scene) {
  // Array to store all explosion functions
  const explosionFunctions = [
    // 1: Basic Particle Explosion
    (position) => {
      const particleCount = 300;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      
      for (let i = 0; i < particleCount; i++) {
        // Random positions in a sphere
        const i3 = i * 3;
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;
        
        // Orange-red color
        colors[i3] = Math.random() * 0.5 + 0.5; // R: 0.5-1.0
        colors[i3 + 1] = Math.random() * 0.5; // G: 0-0.5
        colors[i3 + 2] = 0; // B: 0
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 1.0
      });
      
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      
      // Animation variables
      const velocities = [];
      for (let i = 0; i < particleCount; i++) {
        velocities.push(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3
        );
      }
      
      // Update function for animation
      function update() {
        const positionArray = geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          positionArray[i3] += velocities[i3];
          positionArray[i3 + 1] += velocities[i3 + 1];
          positionArray[i3 + 2] += velocities[i3 + 2];
          
          // Add gravity effect
          velocities[i3 + 1] -= 0.005;
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        // Fade out more slowly
        material.opacity -= 0.005;
        if (material.opacity <= 0) {
          scene.remove(particles);
          geometry.dispose();
          material.dispose();
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    },
    
    // 2: High-Quality Fire Explosion
    (position) => {
      // Create fire particles systems for realistic fire
      const createRealisticFire = () => {
        // Fire parameters
        const particleCount = 600;
        const fireColors = [
          new THREE.Color(0xffc83f), // Yellow
          new THREE.Color(0xff7711), // Orange
          new THREE.Color(0xff3322), // Red
          new THREE.Color(0x220000)  // Dark/Smoke
        ];
        
        // Create sprite textures for fire particles
        const fireTexture = createFireTexture();
        
        // Set up instanced particles for better performance
        const baseGeometry = new THREE.PlaneGeometry(0.5, 0.5);
        const instancedGeometry = new THREE.InstancedBufferGeometry();
        
        // Copy attributes from base geometry
        Object.keys(baseGeometry.attributes).forEach(attributeName => {
          instancedGeometry.setAttribute(attributeName, baseGeometry.attributes[attributeName]);
        });
        instancedGeometry.index = baseGeometry.index;
        
        // Create instance attributes for position, scale, rotation, color, etc.
        const offsets = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const rotations = new Float32Array(particleCount);
        const colorIndices = new Float32Array(particleCount);
        const lifetimes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
          // Initial position (centered at explosion point)
          offsets[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
          offsets[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.3;
          offsets[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;
          
          // Random scale
          scales[i] = Math.random() * 0.5 + 0.1;
          
          // Random rotation
          rotations[i] = Math.random() * Math.PI * 2;
          
          // Weighted color indices (more yellow/orange at start, more smoke at end)
          const r = Math.random();
          if (r < 0.3) colorIndices[i] = 0; // Yellow
          else if (r < 0.6) colorIndices[i] = 1; // Orange
          else if (r < 0.85) colorIndices[i] = 2; // Red
          else colorIndices[i] = 3; // Smoke
          
          // Random lifetime (some particles live longer)
          lifetimes[i] = Math.random() * 0.5 + 0.5;
        }
        
        instancedGeometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
        instancedGeometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1));
        instancedGeometry.setAttribute('rotation', new THREE.InstancedBufferAttribute(rotations, 1));
        instancedGeometry.setAttribute('colorIndex', new THREE.InstancedBufferAttribute(colorIndices, 1));
        instancedGeometry.setAttribute('lifetime', new THREE.InstancedBufferAttribute(lifetimes, 1));
        
        // Create material with custom shader
        const material = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            diffuseTexture: { value: fireTexture },
            colors: { value: fireColors }
          },
          vertexShader: `
            attribute vec3 offset;
            attribute float scale;
            attribute float rotation;
            attribute float colorIndex;
            attribute float lifetime;
            
            varying vec2 vUv;
            varying float vColorIndex;
            varying float vLifetime;
            
            void main() {
              vUv = uv;
              vColorIndex = colorIndex;
              vLifetime = lifetime;
              
              // Position
              vec3 pos = position;
              
              // Apply rotation
              float s = sin(rotation);
              float c = cos(rotation);
              pos.x = position.x * c - position.y * s;
              pos.y = position.x * s + position.y * c;
              
              // Apply scale 
              pos *= scale;
              
              // Final position 
              vec4 worldPosition = modelMatrix * vec4(pos + offset, 1.0);
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `,
          fragmentShader: `
            uniform float time;
            uniform sampler2D diffuseTexture;
            uniform vec3 colors[4];
            
            varying vec2 vUv;
            varying float vColorIndex;
            varying float vLifetime;
            
            void main() {
              // Sample texture
              vec4 texColor = texture2D(diffuseTexture, vUv);
              
              // Get base color from color array
              int index = int(vColorIndex);
              vec3 baseColor = colors[index];
              
              // Modify alpha based on texture and lifetime
              float alpha = texColor.a * vLifetime;
              
              // Output final color
              gl_FragColor = vec4(baseColor * texColor.rgb, alpha);
              
              #include <tonemapping_fragment>
              #include <encodings_fragment>
            }
          `,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        
        // Create mesh
        const fireParticles = new THREE.Mesh(instancedGeometry, material);
        scene.add(fireParticles);
        
        // Animation variables
        const velocities = [];
        for (let i = 0; i < particleCount; i++) {
          // More upward movement for fire effect
          const vx = (Math.random() - 0.5) * 0.05;
          const vy = Math.random() * 0.1 + 0.05; // Upward bias
          const vz = (Math.random() - 0.5) * 0.05;
          velocities.push(new THREE.Vector3(vx, vy, vz));
        }
        
        // Animation function
        let time = 0;
        function updateFire() {
          time += 0.016; // Approx 60fps
          material.uniforms.time.value = time;
          
          const offsets = instancedGeometry.attributes.offset.array;
          const scales = instancedGeometry.attributes.scale.array;
          const lifetimes = instancedGeometry.attributes.lifetime.array;
          
          let allDead = true;
          
          for (let i = 0; i < particleCount; i++) {
            // Update position
            offsets[i * 3] += velocities[i].x;
            offsets[i * 3 + 1] += velocities[i].y;
            offsets[i * 3 + 2] += velocities[i].z;
            
            // Add some turbulence
            offsets[i * 3] += Math.sin(time * 5 + i) * 0.003;
            offsets[i * 3 + 2] += Math.cos(time * 5 + i) * 0.003;
            
            // Decrease lifetime
            lifetimes[i] -= 0.01;
            
            // Increase scale slightly (fire expands as it rises)
            scales[i] *= 1.005;
            
            if (lifetimes[i] > 0) {
              allDead = false;
            }
          }
          
          instancedGeometry.attributes.offset.needsUpdate = true;
          instancedGeometry.attributes.scale.needsUpdate = true;
          instancedGeometry.attributes.lifetime.needsUpdate = true;
          
          if (allDead) {
            scene.remove(fireParticles);
            instancedGeometry.dispose();
            material.dispose();
            return;
          }
          
          requestAnimationFrame(updateFire);
        }
        
        return updateFire;
      };
      
      // Create embers/sparks particles
      const createEmbers = () => {
        const emberCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(emberCount * 3);
        
        for (let i = 0; i < emberCount * 3; i += 3) {
          positions[i] = position.x + (Math.random() - 0.5) * 0.2;
          positions[i + 1] = position.y + (Math.random() - 0.5) * 0.2;
          positions[i + 2] = position.z + (Math.random() - 0.5) * 0.2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create a custom point material with a glowing effect
        const material = new THREE.PointsMaterial({
          size: 0.05,
          color: 0xffaa00,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending
        });
        
        const embers = new THREE.Points(geometry, material);
        scene.add(embers);
        
        // Animation variables
        const velocities = [];
        for (let i = 0; i < emberCount; i++) {
          velocities.push(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2 + 0.05, // Upward bias
            (Math.random() - 0.5) * 0.2
          );
        }
        
        // Animation function
        function updateEmbers() {
          const positions = geometry.attributes.position.array;
          
          let allOutOfView = true;
          
          for (let i = 0; i < emberCount; i++) {
            const i3 = i * 3;
            positions[i3] += velocities[i3];
            positions[i3 + 1] += velocities[i3 + 1];
            positions[i3 + 2] += velocities[i3 + 2];
            
            // Gravity decreases upward velocity
            velocities[i3 + 1] -= 0.005;
            
            // Check if any embers are still visible
            if (positions[i3 + 1] > position.y - 3) {
              allOutOfView = false;
            }
          }
          
          geometry.attributes.position.needsUpdate = true;
          
          // Fade out
          material.opacity -= 0.005;
          if (material.opacity <= 0 || allOutOfView) {
            scene.remove(embers);
            geometry.dispose();
            material.dispose();
            return;
          }
          
          requestAnimationFrame(updateEmbers);
        }
        
        return updateEmbers;
      };
      
      // Create smoke particles
      const createSmoke = () => {
        const smokeCount = 30;
        const smokeGeometry = new THREE.PlaneGeometry(0.8, 0.8);
        
        // Create a smoke texture
        const smokeTexture = createSmokeTexture();
        
        const smokeMaterial = new THREE.MeshBasicMaterial({
          map: smokeTexture,
          transparent: true,
          opacity: 0.4,
          depthWrite: false
        });
        
        const smokes = [];
        const velocities = [];
        
        for (let i = 0; i < smokeCount; i++) {
          const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
          smoke.position.set(
            position.x + (Math.random() - 0.5) * 0.3,
            position.y + (Math.random() - 0.5) * 0.3,
            position.z + (Math.random() - 0.5) * 0.3
          );
          smoke.rotation.z = Math.random() * Math.PI * 2;
          smoke.material.opacity = Math.random() * 0.2 + 0.2;
          
          // Make smoke appear with a delay based on index
          smoke.scale.set(0.01, 0.01, 0.01);
          smoke.userData = {
            delay: i * 50, // ms
            startTime: Date.now() + i * 50, 
            active: false
          };
          
          // Add to scene
          scene.add(smoke);
          smokes.push(smoke);
          
          // Smoke rises slower than fire
          velocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            Math.random() * 0.04 + 0.02,
            (Math.random() - 0.5) * 0.02
          ));
        }
        
        function updateSmoke() {
          const now = Date.now();
          let anyActive = false;
          
          for (let i = 0; i < smokes.length; i++) {
            const smoke = smokes[i];
            
            // Check if this smoke particle should be active
            if (!smoke.userData.active && now >= smoke.userData.startTime) {
              smoke.userData.active = true;
            }
            
            if (smoke.userData.active) {
              // Update position
              smoke.position.add(velocities[i]);
              
              // Slow rotation
              smoke.rotation.z += 0.01;
              
              // Grow in size over time
              if (smoke.scale.x < 1.5) {
                smoke.scale.x += 0.02;
                smoke.scale.y += 0.02;
              }
              
              // Fade out
              smoke.material.opacity -= 0.002;
              
              if (smoke.material.opacity > 0) {
                anyActive = true;
              }
            } else {
              anyActive = true; // Still waiting for some to activate
            }
          }
          
          if (!anyActive) {
            // Clean up
            for (const smoke of smokes) {
              scene.remove(smoke);
              smoke.geometry.dispose();
              smoke.material.dispose();
            }
            return;
          }
          
          requestAnimationFrame(updateSmoke);
        }
        
        return updateSmoke;
      };
      
      // Create light flash for initial explosion
      const createLightFlash = () => {
        const light = new THREE.PointLight(0xff7700, 5, 6);
        light.position.copy(position);
        scene.add(light);
        
        let intensity = 5;
        function updateLight() {
          intensity *= 0.92;
          light.intensity = intensity;
          
          if (intensity < 0.1) {
            scene.remove(light);
            return;
          }
          
          requestAnimationFrame(updateLight);
        }
        
        return updateLight;
      };
      
      // Helper functions to create textures
      function createFireTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Create radial gradient for fire particle
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
      }
      
      function createSmokeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Create radial gradient for smoke
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        gradient.addColorStop(0, 'rgba(90, 90, 90, 1)');
        gradient.addColorStop(0.4, 'rgba(80, 80, 80, 0.5)');
        gradient.addColorStop(1, 'rgba(70, 70, 70, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some noise
        for (let i = 0; i < 3000; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          
          // Get current pixel alpha to respect the gradient
          const data = ctx.getImageData(x, y, 1, 1).data;
          const alpha = data[3] / 255;
          
          if (alpha > 0.1) {
            const noiseValue = Math.random() * 20;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * alpha})`;
            ctx.fillRect(x, y, 2, 2);
          }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
      }
      
      // Start all animations
      const updateFire = createRealisticFire();
      const updateEmbers = createEmbers();
      const updateSmoke = createSmoke();
      const updateLight = createLightFlash();
      
      // Start animations
      updateFire();
      updateEmbers();
      updateSmoke();
      updateLight();
    },
    
    // 3: Ice Explosion (completely reimplemented)
    (position) => {
      // Create main ice shards
      const createIceShards = () => {
        const shardCount = 150;
        const shards = [];
        
        // Ice crystal material with refraction effects
        const iceMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xaaddff,
          metalness: 0.1,
          roughness: 0.1,
          transparent: true,
          opacity: 0.7,
          transmission: 0.9,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          ior: 1.5,
          reflectivity: 0.5,
          thickness: 0.2,
          envMapIntensity: 1.5,
          side: THREE.DoubleSide
        });
        
        // Create varied geometries for shards
        const geometries = [
          new THREE.TetrahedronGeometry(0.2),
          new THREE.ConeGeometry(0.1, 0.3, 8),
          new THREE.BoxGeometry(0.1, 0.2, 0.1)
        ];
        
        for (let i = 0; i < shardCount; i++) {
          // Pick a random geometry
          const geometryIndex = Math.floor(Math.random() * geometries.length);
          const geometry = geometries[geometryIndex].clone();
          
          // Create the shard with a slight color variation
          const shard = new THREE.Mesh(
            geometry, 
            iceMaterial.clone()
          );
          
          // Vary the color slightly
          const hue = Math.random() * 0.1 + 0.5; // Blue range
          const saturation = Math.random() * 0.3 + 0.7;
          const lightness = Math.random() * 0.3 + 0.7;
          shard.material.color.setHSL(hue, saturation, lightness);
          
          // Position randomly around explosion center
          shard.position.copy(position);
          
          // Random size
          const scale = Math.random() * 0.7 + 0.3;
          shard.scale.set(scale, scale, scale);
          
          // Random rotation
          shard.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
          );
          
          // Set velocity
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
          );
          
          // Set rotation rate
          const rotationRate = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
          );
          
          // Add to scene
          scene.add(shard);
          shards.push({
            mesh: shard,
            velocity: velocity,
            rotationRate: rotationRate
          });
        }
        
        // Initial explosion force
        const explosionForce = 0.1;
        for (const shard of shards) {
          // Direction from center to shard position
          const direction = shard.mesh.position.clone().sub(position).normalize();
          shard.velocity.add(direction.multiplyScalar(explosionForce));
        }
        
        function updateShards() {
          let alive = false;
          
          for (const shard of shards) {
            if (shard.mesh.material.opacity <= 0) continue;
            
            alive = true;
            
            // Move shard
            shard.mesh.position.add(shard.velocity);
            
            // Rotate shard
            shard.mesh.rotation.x += shard.rotationRate.x;
            shard.mesh.rotation.y += shard.rotationRate.y;
            shard.mesh.rotation.z += shard.rotationRate.z;
            
            // Apply gravity
            shard.velocity.y -= 0.002;
            
            // Slow down due to "air resistance"
            shard.velocity.multiplyScalar(0.99);
            
            // Fade out
            shard.mesh.material.opacity -= 0.005;
          }
          
          if (!alive) {
            // Clean up
            for (const shard of shards) {
              scene.remove(shard.mesh);
              shard.mesh.geometry.dispose();
              shard.mesh.material.dispose();
            }
            return;
          }
          
          requestAnimationFrame(updateShards);
        }
        
        return updateShards;
      };
      
      // Create frost cloud effect
      const createFrostCloud = () => {
        const cloudCount = 20;
        const cloudParticles = [];
        
        // Create frost texture
        const frostTexture = createFrostTexture();
        
        for (let i = 0; i < cloudCount; i++) {
          // Create a cloud of frost particles
          const cloudGeometry = new THREE.PlaneGeometry(1, 1);
          const cloudMaterial = new THREE.MeshBasicMaterial({
            map: frostTexture,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          
          const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
          
          // Random position around explosion center
          cloud.position.set(
            position.x + (Math.random() - 0.5) * 0.5,
            position.y + (Math.random() - 0.5) * 0.5,
            position.z + (Math.random() - 0.5) * 0.5
          );
          
          // Random rotation
          cloud.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
          );
          
          // Random scale
          const scale = Math.random() * 0.5 + 0.5;
          cloud.scale.set(scale, scale, scale);
          
          // Look at camera approximately
          cloud.lookAt(new THREE.Vector3(0, 0, 5));
          
          // Velocity (slower than shards)
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
          );
          
          scene.add(cloud);
          cloudParticles.push({
            mesh: cloud,
            velocity: velocity,
            initialScale: scale
          });
        }
        
        function updateCloud() {
          let alive = false;
          
          for (const particle of cloudParticles) {
            if (particle.mesh.material.opacity <= 0) continue;
            
            alive = true;
            
            // Move cloud
            particle.mesh.position.add(particle.velocity);
            
            // Grow and fade
            particle.mesh.scale.addScalar(0.01);
            particle.mesh.material.opacity -= 0.01;
          }
          
          if (!alive) {
            // Clean up
            for (const particle of cloudParticles) {
              scene.remove(particle.mesh);
              particle.mesh.geometry.dispose();
              particle.mesh.material.dispose();
            }
            return;
          }
          
          requestAnimationFrame(updateCloud);
        }
        
        return updateCloud;
      };
      
      // Create a frost ray effect (spiky beams shooting out)
      const createFrostRays = () => {
        const rayCount = 12;
        const rays = [];
        
        for (let i = 0; i < rayCount; i++) {
          // Create a ray geometry
          const rayHeight = Math.random() * 1.5 + 1.0;
          const rayGeometry = new THREE.CylinderGeometry(0.01, 0.05, rayHeight, 8);
          rayGeometry.translate(0, rayHeight / 2, 0);
          
          const rayMaterial = new THREE.MeshBasicMaterial({
            color: 0xb8e3ff,
            transparent: true,
            opacity: 0.7
          });
          
          const ray = new THREE.Mesh(rayGeometry, rayMaterial);
          ray.position.copy(position);
          
          // Random direction
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          
          ray.userData = {
            direction: new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.sin(phi) * Math.sin(theta),
              Math.cos(phi)
            ),
            speed: Math.random() * 0.1 + 0.1
          };
          
          // Orient ray along direction
          ray.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            ray.userData.direction
          );
          
          scene.add(ray);
          rays.push(ray);
        }
        
        function updateRays() {
          let alive = false;
          
          for (const ray of rays) {
            if (ray.material.opacity <= 0) continue;
            
            alive = true;
            
            // Stretch ray
            ray.scale.y *= 1.03;
            
            // Fade out
            ray.material.opacity -= 0.02;
          }
          
          if (!alive) {
            // Clean up
            for (const ray of rays) {
              scene.remove(ray);
              ray.geometry.dispose();
              ray.material.dispose();
            }
            return;
          }
          
          requestAnimationFrame(updateRays);
        }
        
        return updateRays;
      };
      
      // Create a cold light flash
      const createColdLight = () => {
        const light = new THREE.PointLight(0x88ddff, 5, 6);
        light.position.copy(position);
        scene.add(light);
        
        let intensity = 5;
        function updateLight() {
          intensity *= 0.92;
          light.intensity = intensity;
          
          if (intensity < 0.1) {
            scene.remove(light);
            return;
          }
          
          requestAnimationFrame(updateLight);
        }
        
        return updateLight;
      };
      
      // Helper function to create frost texture
      function createFrostTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Fill with gradient
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(220, 240, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(200, 230, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw frost pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        
        // Draw a snowflake-like pattern
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const branches = 6;
        const maxLen = canvas.width / 2;
        
        for (let branch = 0; branch < branches; branch++) {
          const angle = (branch / branches) * Math.PI * 2;
          
          // Main branch
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          const endX = centerX + Math.cos(angle) * maxLen;
          const endY = centerY + Math.sin(angle) * maxLen;
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Sub branches
          const subBranches = 8;
          const subLength = maxLen * 0.4;
          
          for (let i = 1; i <= subBranches; i++) {
            const t = i / (subBranches + 1);
            const pointX = centerX + Math.cos(angle) * maxLen * t;
            const pointY = centerY + Math.sin(angle) * maxLen * t;
            
            // Two sub branches at each point
            for (let dir = -1; dir <= 1; dir += 2) {
              const subAngle = angle + dir * Math.PI / 3;
              ctx.beginPath();
              ctx.moveTo(pointX, pointY);
              const subEndX = pointX + Math.cos(subAngle) * subLength * t;
              const subEndY = pointY + Math.sin(subAngle) * subLength * t;
              ctx.lineTo(subEndX, subEndY);
              ctx.stroke();
            }
          }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
      }
      
      // Start all animations
      const updateShards = createIceShards();
      const updateCloud = createFrostCloud();
      const updateRays = createFrostRays();
      const updateLight = createColdLight();
      
      updateShards();
      updateCloud();
      updateRays();
      updateLight();
    },
    
    // 4: Smoke Explosion
    (position) => {
      const particleCount = 50;
      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      
      for (let i = 0; i < particleCount; i++) {
        const x = position.x + (Math.random() - 0.5) * 0.2;
        const y = position.y + (Math.random() - 0.5) * 0.2;
        const z = position.z + (Math.random() - 0.5) * 0.2;
        vertices.push(x, y, z);
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      const material = new THREE.PointsMaterial({
        size: 0.2,
        color: 0x666666,
        transparent: true,
        opacity: 0.8
      });
      
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      
      // Animation variables
      const velocities = [];
      const sizes = [];
      
      for (let i = 0; i < particleCount; i++) {
        velocities.push(
          (Math.random() - 0.5) * 0.02,
          Math.random() * 0.06,
          (Math.random() - 0.5) * 0.02
        );
        sizes.push(Math.random() * 0.2 + 0.1);
      }
      
      // Update function
      function update() {
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          positions[i3] += velocities[i3];
          positions[i3 + 1] += velocities[i3 + 1];
          positions[i3 + 2] += velocities[i3 + 2];
          
          sizes[i] *= 1.01; // Grow particles
        }
        
        geometry.attributes.position.needsUpdate = true;
        material.size = Math.max(...sizes);
        
        // Fade out
        material.opacity -= 0.005;
        if (material.opacity <= 0) {
          scene.remove(particles);
          geometry.dispose();
          material.dispose();
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    },
    
    // 5: Shockwave Explosion
    (position) => {
      const geometry = new THREE.RingGeometry(0.1, 0.2, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
      });
      
      const ring = new THREE.Mesh(geometry, material);
      ring.position.copy(position);
      
      // Orient the ring to face the camera
      ring.lookAt(0, 0, 5);
      
      scene.add(ring);
      
      // Wave parameters
      let scale = 0.1;
      
      // Update function
      function update() {
        scale *= 1.08;
        ring.scale.set(scale, scale, scale);
        
        material.opacity -= 0.02;
        
        if (material.opacity <= 0) {
          scene.remove(ring);
          geometry.dispose();
          material.dispose();
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    },
    
    // 6: Glass Shards Explosion
    (position) => {
      const shardCount = 40;
      const shards = [];
      
      for (let i = 0; i < shardCount; i++) {
        // Create a random triangular shard
        const geometry = new THREE.BufferGeometry();
        const size = Math.random() * 0.2 + 0.05;
        
        const vertices = [
          0, 0, 0,
          size, 0, 0,
          0, size, 0
        ];
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const material = new THREE.MeshBasicMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        });
        
        const shard = new THREE.Mesh(geometry, material);
        shard.position.copy(position);
        
        // Random rotation
        shard.rotation.x = Math.random() * Math.PI * 2;
        shard.rotation.y = Math.random() * Math.PI * 2;
        shard.rotation.z = Math.random() * Math.PI * 2;
        
        // Random velocity
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );
        
        shards.push({ mesh: shard, velocity });
        scene.add(shard);
      }
      
      // Update function
      function update() {
        let alive = false;
        
        for (const { mesh, velocity } of shards) {
          if (mesh.material.opacity <= 0) continue;
          
          alive = true;
          
          // Move shard
          mesh.position.add(velocity);
          
          // Add gravity
          velocity.y -= 0.005;
          
          // Rotate shard
          mesh.rotation.x += 0.02;
          mesh.rotation.y += 0.02;
          
          // Fade out
          mesh.material.opacity -= 0.01;
        }
        
        if (!alive) {
          // Clean up
          for (const { mesh } of shards) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
          }
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    },
    
    // 7: Colorful Confetti Explosion
    (position) => {
      const particleCount = 200;
      const particles = [];
      
      const colors = [
        0xff0000, 0x00ff00, 0x0000ff,
        0xffff00, 0xff00ff, 0x00ffff,
        0xff8800, 0x88ff00, 0x0088ff
      ];
      
      for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.PlaneGeometry(0.1, 0.1);
        const material = new THREE.MeshBasicMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        // Random initial velocity
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );
        
        // Random rotation
        particle.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
        particles.push({ mesh: particle, velocity });
        scene.add(particle);
      }
      
      // Update function
      function update() {
        let alive = false;
        
        for (const { mesh, velocity } of particles) {
          if (mesh.material.opacity <= 0) continue;
          
          alive = true;
          
          // Move particle
          mesh.position.add(velocity);
          
          // Add gravity
          velocity.y -= 0.003;
          
          // Add spin
          mesh.rotation.x += Math.random() * 0.1;
          mesh.rotation.y += Math.random() * 0.1;
          mesh.rotation.z += Math.random() * 0.1;
          
          // Fade out
          mesh.material.opacity -= 0.005;
        }
        
        if (!alive) {
          // Clean up
          for (const { mesh } of particles) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
          }
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    },
    
    // 8: Pixel Explosion
    (position) => {
      const size = 0.05;
      const cubeCount = 100;
      const cubes = [];
      
      for (let i = 0; i < cubeCount; i++) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshBasicMaterial({
          color: Math.random() * 0xffffff,
          transparent: true,
          opacity: 1.0
        });
        
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(position);
        
        // Random velocity
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );
        
        cubes.push({ mesh: cube, velocity });
        scene.add(cube);
      }
      
      // Update function
      function update() {
        let alive = false;
        
        for (const { mesh, velocity } of cubes) {
          if (mesh.material.opacity <= 0) continue;
          
          alive = true;
          
          // Move cube
          mesh.position.add(velocity);
          
          // Add gravity
          velocity.y -= 0.005;
          
          // Rotate cube
          mesh.rotation.x += 0.05;
          mesh.rotation.y += 0.05;
          mesh.rotation.z += 0.05;
          
          // Fade out
          mesh.material.opacity -= 0.01;
        }
        
        if (!alive) {
          // Clean up
          for (const { mesh } of cubes) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
          }
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    },
    
    // 9: Spiral Explosion
    (position) => {
      const particleCount = 150;
      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      
      for (let i = 0; i < particleCount; i++) {
        vertices.push(position.x, position.y, position.z);
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xff00ff,
        transparent: true,
        opacity: 1.0
      });
      
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      
      // Spiral parameters
      const spiralAngles = [];
      const spiralRadii = [];
      const spiralHeights = [];
      const spiralSpeeds = [];
      
      for (let i = 0; i < particleCount; i++) {
        spiralAngles.push(Math.random() * Math.PI * 2);
        spiralRadii.push(0.01);
        spiralHeights.push((Math.random() - 0.5) * 0.05);
        spiralSpeeds.push(Math.random() * 0.2 + 0.1);
      }
      
      // Update function
      function update() {
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          
          // Update spiral parameters
          spiralAngles[i] += spiralSpeeds[i];
          spiralRadii[i] += 0.01;
          
          // Calculate new position on spiral
          positions[i3] = position.x + Math.cos(spiralAngles[i]) * spiralRadii[i];
          positions[i3 + 1] = position.y + spiralHeights[i] * spiralRadii[i];
          positions[i3 + 2] = position.z + Math.sin(spiralAngles[i]) * spiralRadii[i];
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        // Fade out
        material.opacity -= 0.01;
        if (material.opacity <= 0) {
          scene.remove(particles);
          geometry.dispose();
          material.dispose();
          return;
        }
        
        requestAnimationFrame(update);
      }
      
      update();
    }
  ];
  
  return explosionFunctions;
} 