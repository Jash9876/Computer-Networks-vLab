// Module 2: Command Simulator

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');

    if (!input || !output) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            if (cmd) {
                printOutput(`C:\\> ${cmd}`);
                processCommand(cmd);
                input.value = '';

                // Scroll to bottom
                output.parentElement.scrollTop = output.parentElement.scrollHeight;
            }
        }
    });

    function printOutput(text) {
        output.textContent += `\n${text}`;
    }

    function processCommand(cmd) {
        const args = cmd.split(' ').filter(Boolean);
        const baseCmd = args[0].toLowerCase();
        let target = args.length > 1 ? args[1] : '';

        // Log observation
        if (typeof addObservation === 'function') {
            addObservation("Command Simulator", "Executed: " + cmd, "Success");
        }

        switch (baseCmd) {
            case 'help':
                printOutput("Supported commands: ping, tracert, arp, netstat, ssh, nslookup, clear");
                break;
            case 'clear':
                output.textContent = '';
                break;
            case 'ping':
                if (!target) target = "192.168.1.1";
                printOutput(`Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time=14ms TTL=54\nReply from ${target}: bytes=32 time=15ms TTL=54\nReply from ${target}: bytes=32 time=13ms TTL=54\nReply from ${target}: bytes=32 time=16ms TTL=54\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`);
                break;
            case 'tracert':
                if (!target) target = "google.com";
                printOutput(`Tracing route to ${target} [142.250.190.46]\nover a maximum of 30 hops:\n\n  1    <1 ms    <1 ms    <1 ms  192.168.1.1\n  2    10 ms    12 ms    11 ms  10.0.0.1\n  3    20 ms    19 ms    21 ms  142.250.190.46\n\nTrace complete.`);
                break;
            case 'arp':
                if (args[1] === '-a') {
                    printOutput(`Interface: 192.168.1.5 --- 0x4\n  Internet Address      Physical Address      Type\n  192.168.1.1           00-14-22-01-23-45     dynamic\n  192.168.1.255         ff-ff-ff-ff-ff-ff     static`);
                } else {
                    printOutput(`Usage: arp -a`);
                }
                break;
            case 'netstat':
                printOutput(`Active Connections\n\n  Proto  Local Address          Foreign Address        State\n  TCP    127.0.0.1:54321        127.0.0.1:54322        ESTABLISHED\n  TCP    192.168.1.5:443        104.21.23.45:443       ESTABLISHED`);
                break;
            case 'ssh':
                if (!target) target = "user@192.168.1.10";
                printOutput(`The authenticity of host '${target.split('@')[1] || target}' can't be established.\nECDSA key fingerprint is SHA256:abcd1234efgh5678.\nAre you sure you want to continue connecting (yes/no/[fingerprint])?\nConnection closed by remote host.`);
                break;
            case 'nslookup':
                if (!target) target = "example.com";
                printOutput(`Server:  UnKnown\nAddress:  192.168.1.1\n\nNon-authoritative answer:\nName:    ${target}\nAddress:  93.184.216.34`);
                break;
            default:
                printOutput(`'${baseCmd}' is not recognized as an internal or external command.`);
        }
    }
});
