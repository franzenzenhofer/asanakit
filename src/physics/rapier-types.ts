/**
 * Structural types for the slice of Rapier that asanakit uses.
 *
 * Rapier ships full TypeScript types, but its declaration files import
 * relative paths without extensions ("./exports", "./dynamics"), which
 * NodeNext module resolution cannot follow - the whole module silently
 * degrades to `any`. Rather than give up type safety across the physics
 * code, the boundary in world.ts casts ONCE onto these honest structural
 * types, which mirror the documented Rapier API one-to-one.
 */

export interface RapierVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RapierRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export type RapierQuaternion = RapierRotation;

export interface RigidBodyDesc {
  setTranslation(x: number, y: number, z: number): RigidBodyDesc;
  setLinearDamping(v: number): RigidBodyDesc;
  setAngularDamping(v: number): RigidBodyDesc;
}

export interface ColliderDesc {
  setTranslation(x: number, y: number, z: number): ColliderDesc;
  setRotation(q: RapierRotation): ColliderDesc;
  setFriction(v: number): ColliderDesc;
  setRestitution(v: number): ColliderDesc;
}

export interface RigidBody {
  isSleeping(): boolean;
  translation(): RapierVector;
  rotation(): RapierRotation;
}

export interface World {
  timestep: number;
  createRigidBody(desc: RigidBodyDesc): RigidBody;
  createCollider(desc: ColliderDesc, parent: RigidBody): unknown;
  step(): void;
  free(): void;
}

export interface RapierApi {
  init(): Promise<unknown>;
  World: new (gravity: RapierVector) => World;
  Quaternion: new (x: number, y: number, z: number, w: number) => RapierQuaternion;
  RigidBodyDesc: {
    dynamic(): RigidBodyDesc;
    fixed(): RigidBodyDesc;
  };
  ColliderDesc: {
    capsule(halfHeight: number, radius: number): ColliderDesc;
    cuboid(hx: number, hy: number, hz: number): ColliderDesc;
    ball(radius: number): ColliderDesc;
  };
}
