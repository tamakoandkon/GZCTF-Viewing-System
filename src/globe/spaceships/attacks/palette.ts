const CHALLENGE_COLORS: Record<string, string> = {
    Web: '#ff6b6b',
    Crypto: '#4ecdc4',
    Pwn: '#45b7d1',
    Reverse: '#96ceb4',
    Blockchain: '#feca57',
    Forensics: '#ff9ff3',
    Hardware: '#54a0ff',
    Mobile: '#5f27cd',
    PPC: '#00d2d3',
    AI: '#ff6348',
    Pentest: '#2ed573',
    OSINT: '#ffa502',
    Misc: '#ff7675',
};

export function getChallengeColor(category: string): string {
    return CHALLENGE_COLORS[category] ?? '#ffffff';
}
