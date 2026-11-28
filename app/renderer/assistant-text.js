export function assistantError(error) {
  return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}
