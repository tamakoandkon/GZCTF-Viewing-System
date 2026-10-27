import * as THREE from 'three';

export function createTextTexture(
    text: string,
    fontSize = 64,
    textColor = '#ffffff',
    bgColor = 'transparent',
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas context is unavailable');

    canvas.width = 512;
    canvas.height = 128;

    context.font = `bold ${fontSize}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    if (bgColor !== 'transparent') {
        context.fillStyle = bgColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.strokeStyle = '#000000';
    context.lineWidth = 8;
    context.strokeText(text, canvas.width / 2, canvas.height / 2);

    context.fillStyle = textColor;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export function createCountryLabel(
    countryName: string,
    labelText: string,
    color: string,
    position: { x: number; y: number; z: number },
    radius: number,
): THREE.Sprite {
    const texture = createTextTexture(labelText, 84, color);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        depthTest: true,
    });

    const sprite = new THREE.Sprite(material);
    const labelHeight = 12;
    const labelPosition = new THREE.Vector3(position.x, position.y, position.z);
    labelPosition.normalize().multiplyScalar(radius + labelHeight);
    sprite.position.copy(labelPosition);

    const baseScale = 70;
    const lengthScale = labelText.length * 8;
    const scale = Math.max(baseScale, lengthScale);
    sprite.scale.set(scale, scale / 3.5, 1);
    sprite.userData = { countryName, labelText, type: 'countryLabel' };
    return sprite;
}

export function disposeCountryLabel(label: THREE.Sprite): void {
    label.material.map?.dispose();
    label.material.dispose();
}
