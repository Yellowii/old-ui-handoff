import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TextureLoader} from 'three';
import {ImageLoader} from 'three';
import {CubeTextureLoader} from 'three';
import {resolveAsset} from './services.js';

class ResolvedLoader {
  constructor(loader, kind, runtimePolicy) {
    this.loader = loader;
    this.kind = kind;
    this.runtimePolicy = runtimePolicy;
  }

  async resolve(url, context = {}) {
    if (Array.isArray(url)) return Promise.all(url.map((face, faceIndex) => this.resolve(face, {...context, faceIndex})));
    const ref = typeof url === 'string' ? {url} : url;
    const resolved = await resolveAsset(ref, {kind: this.kind, runtimePolicy: this.runtimePolicy, ...context});
    if (!resolved) throw new Error(`Asset URL unavailable for ${this.kind}`);
    return resolved;
  }

  load(url, onLoad, onProgress, onError) {
    this.resolve(url).then(resolved => this.loader.load(resolved, onLoad, onProgress, onError)).catch(onError);
    return this;
  }

  async loadAsync(url, onProgress) {
    return this.loader.loadAsync(await this.resolve(url), onProgress);
  }
}

export class AssetLoaders {
  constructor(runtimePolicy) {
    this.gltf = new ResolvedLoader(new GLTFLoader(), 'gltf', runtimePolicy);
    this.texture = new ResolvedLoader(new TextureLoader(), 'texture', runtimePolicy);
    this.image = new ResolvedLoader(new ImageLoader(), 'image', runtimePolicy);
    this.cubeTexture = new ResolvedLoader(new CubeTextureLoader(), 'cube-texture', runtimePolicy);
  }
}

export function installAssetLoaders(runtimePolicy) {
  return new AssetLoaders(runtimePolicy);
}
