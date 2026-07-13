/**
 * Prop meshes for the three.js scene (viewer and GLB export), built from the
 * same world-space geometry the 2D renderer projects - one definition of a
 * mat or a surfboard, every output agrees.
 */
import {
  BoxGeometry,
  ExtrudeGeometry,
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
const MAT_FRONT_COLOR = '#c1121f';
const BOARD_COLOR = '#efe9da';

/** How much of the mat's length and width the front tick claims. */
const FRONT_BAND = 0.04;
const FRONT_TICK = 0.3;

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

const material = (color: string): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

/**
 * A mat you can read: the top face is lighter than the sides, so you can see
 * which way is up even from a low camera, and a band across the front short
 * edge (+z, the way the figure faces) tells the front of the mat from the back.
 * Six materials, in three.js's box face order: +x, -x, +y, -y, +z, -z.
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

  // The front tick sits a hair proud of the top face so it never z-fights.
  const bandLength = model.length * FRONT_BAND;
  const band = new Mesh(
    new BoxGeometry(model.width * FRONT_TICK, model.thickness * 0.2, bandLength),
    material(MAT_FRONT_COLOR),
  );
  band.name = 'prop:mat:front';
  band.position.set(0, model.thickness / 2, (model.length - bandLength) / 2);

  const group = new Group();
  group.name = 'prop:mat';
  group.add(slab, band);
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
