import { spawn, spawnSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';


export default class CliHelper extends EventEmitter {
    private command: string;
    private args: string[];
    private process: ChildProcess | null = null;
    private erroredViaProcessErrorEvent: boolean = false;

    constructor(command: string, args: string[]) {
        super();
        this.command = command;
        this.args = args;
    }

    public execute(): void {
        
        if (this.process) {
            // Optionally emit an error or throw if execute is called multiple times
            // For now, we allow re-execution if the previous one finished.
            if (this.process.exitCode === null && this.process.signalCode === null) {
                this.emit('error', new Error('Process is already running.'));
                return;
            }
        }

        this.process = spawn(this.command, this.args);
        this.erroredViaProcessErrorEvent = false;

        this.process.on('error', (err: Error) => {
            this.erroredViaProcessErrorEvent = true;
            console.error('error', new Error(`Failed to execute ${this.command}: ${err.message}`));
            this.emit('error', new Error(`Failed to execute ${this.command}: ${err.message}`));
        });

        this.process.on('close', (code: number) => {
            // Ensure 'close' isn't processed if 'error' event already handled the failure (e.g., ENOENT)
            if (this.erroredViaProcessErrorEvent) {
                this.process = null; // Reset process state
                return;
            }

            if (code === 0) {
                this.emit('success');
            } else {
                this.emit('error', new Error(`${this.command} exited with code ${code}`));
            }
            this.process = null; // Reset process state to allow potential re-execution
        });

        // Example: If you also want to stream stdout/stderr
        this.process.stdout?.on('data', (data: string) => this.emit('stdout_data', data));
        this.process.stderr?.on('data', (data: string) => this.emit('stderr_data', data));
    }

    // executeBlocking method which just errors out if there is ever an error and returns stderr, or if no error, return stdin.
    public executeSync(): string {
        if (this.process) {
            throw new Error('Process is already running. Cannot execute blocking command.');
        }

        try {
            const result = spawnSync(this.command, this.args, { encoding: 'utf8' });

            if (result.error) {
                throw result.error;
            }

            if (result.status !== 0) {
                throw new Error(`${this.command} exited with code ${result.status}: ${result.stderr}`);
            }

            if (result.status === 0 && result.stderr) {
                console.error(`${this.command} exited with code 0 but there were some errors: ${result.stderr}`);
                // throw new Error(`${this.command} exited with code 0 but there were some errors: ${result.stderr}`);
            }
            console.log(result.stdout.toString());
            return result.stdout;
        } catch (error) {
            console.error(`Blocking execution error for command ${this.command}`, error);
            throw error;
        }
    }

    public static extractVersionNumber(fromText: string): number {
        const versionMatch = fromText.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
            return parseFloat(versionMatch[0]);
        }
        throw new Error('No version number found in the provided text');
    }
}
