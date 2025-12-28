type Penalty = '' | '+2' | 'DNF';

export type Solve = {
    id: string;
    time: number;
    type: string;
    penalty: Penalty;
    scramble: string;
    comment: string;
    timestamp: number;
    session?: string;
}