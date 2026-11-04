// Superficie de dibujo: un canvas 2D convertido en textura y aplicado a un plano.
// Se dibuja solo cuando hace falta (no en cada cuadro).

const THREE = () => globalThis.AFRAME.THREE;

export class CanvasSurface {
  /**
   * @param {number} widthM   ancho en metros
   * @param {number} heightM  alto en metros
   * @param {number} pxPerM   resolución (píxeles por metro)
   */
  constructor(widthM, heightM, pxPerM = 1000, { anisotropy = 4 } = {}) {
    const T = THREE();
    this.widthM = widthM;
    this.heightM = heightM;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(widthM * pxPerM);
    this.canvas.height = Math.round(heightM * pxPerM);
    this.ctx = this.canvas.getContext('2d');
    this.pxPerM = pxPerM;
    this.texture = new T.CanvasTexture(this.canvas);
    this.texture.colorSpace = T.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = T.LinearMipmapLinearFilter;
    this.material = new T.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false });
    this.geometry = new T.PlaneGeometry(widthM, heightM);
    this.mesh = new T.Mesh(this.geometry, this.material);
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  /** Limpia y dibuja con fn(ctx, width, height). */
  draw(fn) {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    fn(ctx, this.canvas.width, this.canvas.height);
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
