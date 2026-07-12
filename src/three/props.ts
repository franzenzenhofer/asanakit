/**
 * Prop meshes for the three.js scene (viewer and GLB export), built from the
 * same world-space geometry the 2D renderer projects - one definition of a
 * mat or a surfboard, every output agrees.
 */
import {
  BoxGeometry,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Vector3,
  type Object3D,
} from 'three';
import { degToRad } from '../core/angles.js';
import type { Skeleton } from '../core/types.js';
import type { Prop } from '../model/schema.js';
import { BOARD_PLAN, matModel, surfboardModel, type SurfboardProp } from '../props/geometry.js';

const MAT_COLOR = '#9fb8c8';
const BOARD_COLOR = '#efe9da';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

const material = (color: string): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

const matMesh = (prop: Extract<Prop, { type: 'mat' }>, skeleton: Skeleton): Mesh => {
  const model = matModel(prop, skeleton);
  const mesh = new Mesh(new BoxGeometry(model.width, model.thickness, model.length), material(MAT_COLOR));
  mesh.name = 'prop:mat';
  mesh.position.set(model.centre[0], model.centre[1], model.centre[2]);
  mesh.rotation.y = degToRad(model.yaw);
  return mesh;
};

const surfboardMesh = (prop: SurfboardProp, skeleton: Skeleton): Mesh => {
  const model = surfboardModel(prop, skeleton);

  // Shape space: x along the board, y across; extrusion adds z (thickness).
  const plan = new Shape();
  BOARD_PLAN.forEach(([u, v], i) => {
    const x = u * model.length;
    const y = v * model.width;
    if (i === 0) plan.moveTo(x, y);
    else plan.lineTo(x, y);
  });
  plan.closePath();

  const mesh = new Mesh(
    new ExtrudeGeometry(plan, { depth: model.thickness, bevelEnabled: false }),
    material(BOARD_COLOR),
  );
  mesh.name = 'prop:surfboard';

  // Lay the plan flat: shape-x (along) -> world +z, shape-y (across) -> world
  // +x, extrusion -> up. Then pitch the nose up by `rotation`.
  const flat = new Quaternion()
    .setFromAxisAngle(Y, -Math.PI / 2)
    .multiply(new Quaternion().setFromAxisAngle(X, -Math.PI / 2));
  mesh.quaternion.copy(new Quaternion().setFromAxisAngle(X, -degToRad(model.pitch)).multiply(flat));
  // The deck (top of the extrusion) sits at the model's centre height.
  mesh.position.set(model.centre[0], model.centre[1], model.centre[2]);
  mesh.translateZ(-model.thickness); // in shape space: pull the deck up to the centre
  return mesh;
};

/** The props that exist as honest 3D objects; the rest are 2D diagram furniture. */
export const buildPropMeshes = (props: readonly Prop[], skeleton: Skeleton): Object3D[] =>
  props.flatMap((prop): Object3D[] => {
    if (prop.type === 'mat') return [matMesh(prop, skeleton)];
    if (prop.type === 'surfboard') return [surfboardMesh(prop, skeleton)];
    return [];
  });
