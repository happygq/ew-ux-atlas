/**
 * EW-UX research compass.
 * World convention: +Z = geographic-design North, +X = East, +Y = up.
 * The compass is a planning aid, NOT the device magnetometer nor a change
 * to geometry, topology, Add/Remove, or the ground-truth entrance direction.
 */
export const WORLD_NORTH=Object.freeze([0,0,1]);
export const WORLD_EAST=Object.freeze([1,0,0]);
const RAD=180/Math.PI;
export function normalizedAzimuth(degrees){
  if(!Number.isFinite(degrees))throw new RangeError('azimuth must be finite');
  return ((degrees%360)+360)%360;
}
export function compassAtYaw(yaw,preferredFacing=180,radius=35){
  if(!Number.isFinite(yaw)||!Number.isFinite(radius)||radius<=0)
    throw new RangeError('invalid compass camera geometry');
  const facing=normalizedAzimuth(preferredFacing);
  const project=deg=>{
    const a=deg/RAD-yaw;
    return {x:Math.round(radius*Math.sin(a)*10000)/10000,
            y:Math.round(radius*Math.cos(a)*10000)/10000};
  };
  return {
    heading:normalizedAzimuth(yaw*RAD+180),
    labels:[
      {key:'N',...project(0)},{key:'E',...project(90)},
      {key:'S',...project(180)},{key:'W',...project(270)}],
    preferred:{bearing:facing,...project(facing)}
  };
}
