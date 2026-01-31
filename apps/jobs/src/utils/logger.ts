import pc from 'picocolors';

export const logger = {
  info: (msg: string) =>
    console.log(`${pc.blue('ℹ')} ${pc.dim('[minato]')} ${msg}`),
  success: (msg: string) =>
    console.log(`${pc.green('✔')} ${pc.bold(msg)}`),
  warn: (msg: string) =>
    console.log(`${pc.yellow('⚠')} ${msg}`),
  error: (msg: string) =>
    console.log(`${pc.red('✖')} ${pc.red(msg)}`),
  step: (name: string, status: string) =>
    console.log(
      `${pc.cyan('↳')} ${pc.bold(name.padEnd(18))} ${pc.dim('→')} ${pc.green(status)}`
    ),
};