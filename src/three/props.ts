/**
 * Prop meshes for the three.js scene (viewer and GLB export), built from the
 * same world-space geometry the 2D renderer projects - one definition of a
 * mat or a surfboard, every output agrees.
 */
import {
  DoubleSide,
  BoxGeometry,
  ExtrudeGeometry,
  ShapeGeometry,
  Group,
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

const MAT_TOP_COLOR = '#b8ccd8';
const MAT_EDGE_COLOR = '#6d8494';
const MAT_ARROW_COLOR = '#5a7080';
const BOARD_COLOR = '#efe9da';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

const material = (color: string): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

/**
 * A mat you can read: the top face is lighter than the sides, so you can see
 * which way is up even from a low camera, and a flat arrow lying on it points
 * at the front (+z, the way the figure faces). Six materials, in three.js's box
 * face order: +x, -x, +y, -y, +z, -z.
 */
const matMesh = (prop: Extract<Prop, { type: 'mat' }>, skeleton: Skeleton): Group => {
  const model = matModel(prop, skeleton);
  const edge = material(MAT_EDGE_COLOR);
  const slab = new Mesh(new BoxGeometry(model.width, model.thickness, model.length), [
    edge,
    edge,
    material(MAT_TOP_COLOR),
    edge,
    edge,
    edge,
  ]);
  slab.name = 'prop:mat:slab';

  // The same arrow the 2D drawing uses, from the same model: laid flat on the
  // top face, a hair proud of it so it never z-fights. The group carries the
  // yaw, so the arrow is unrotated back into the mat's own frame.
  const plan = new Shape();
  const [cx, , cz] = model.centre;
  const r = -degToRad(model.yaw);
  model.frontArrow.forEach(([x, , z], i) => {
    const dx = x - cx;
    const dz = z - cz;
    const lx = dx * Math.cos(r) + dz * Math.sin(r);
    const lz = -dx * Math.sin(r) + dz * Math.cos(r);
    if (i === 0) plan.moveTo(lx, lz);
    else plan.lineTo(lx, lz);
  });
  plan.closePath();

  // Lay the plan flat: shape-y becomes world +z, so the arrow points at the
  // mat's front. That turns the face downward, so the material is double-sided.
  const arrowMaterial = material(MAT_ARROW_COLOR);
  arrowMaterial.side = DoubleSide;
  const arrow = new Mesh(new ShapeGeometry(plan), arrowMaterial);
  arrow.name = 'prop:mat:front';
  arrow.rotation.x = Math.PI / 2;
  arrow.position.y = model.thickness / 2 + model.thickness * 0.08;

  const group = new Group();
  group.name = 'prop:mat';
  group.add(slab, arrow);
  group.position.set(model.centre[0], model.centre[1], model.centre[2]);
  group.rotation.y = degToRad(model.yaw);
  return group;
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
