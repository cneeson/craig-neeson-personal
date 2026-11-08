import type { EmployerBeat } from '@/scene/choreography';
import { jobs, type Job } from './jobs';

export interface Stop {
    name: string;
    role: string;
    place: string;
    dates: string;
    /** One line for the sign over the city. */
    line: string;
    /** The full entries, for the details opened from the sign. */
    jobs: Job[];
    /** For the university, which isn't a job. */
    details?: string[];
}

const jobsAt = (employer: string) => jobs.filter(job => job.employer === employer);

/** The stops along the career walk over Belfast, by the beat that shows each one. */
export const stops: Record<EmployerBeat, Stop> = {
    coleraine: {
        name: 'Ulster University',
        role: 'BSc Computing, First Class Honours',
        place: 'Coleraine',
        dates: '2013 – 2017',
        line: 'Four years on the north coast, with a year out in industry.',
        jobs: [],
        details: [
            'Bachelor of Science in Computing, graduating with First Class Honours.',
            'A placement year at Nitec Solutions, building production systems for clients across Northern Ireland.',
        ],
    },
    antrim: {
        name: 'Nitec Solutions',
        role: 'Placement Student → Software Developer',
        place: 'Antrim',
        dates: '2012 – 2018',
        line: 'Full-stack systems for factories, live truck-tracking maps and a 3D window designer.',
        jobs: jobsAt('Nitec Solutions'),
    },
    liberty: {
        name: 'Liberty IT',
        role: 'Associate Software Engineer',
        place: 'Adelaide Street',
        dates: '2017',
        line: 'Integrations behind a greenfield insurance platform, at scale.',
        jobs: jobsAt('Liberty Information Technology'),
    },
    flexera: {
        name: 'Flexera',
        role: 'UI Engineer',
        place: 'Adelaide Street',
        dates: '2018 – 2019',
        line: 'Its first component library: accessible UIs for 8 products used by the Fortune 50.',
        jobs: jobsAt('Flexera'),
    },
    locum: {
        name: 'Locate a Locum',
        role: 'Software Developer',
        place: 'The Gasworks',
        dates: '2019 – 2021',
        line: 'Led the move to React and TypeScript, and built its first design system.',
        jobs: jobsAt('Locate a Locum'),
    },
    ankorstore: {
        name: 'Ankorstore',
        role: 'Senior Frontend Engineer',
        place: 'Paris, remotely',
        dates: '2021 – 2025',
        line: 'Vue and Nuxt across the marketplace, logistics and checkout, as it grew from 50 to 400 people.',
        jobs: jobsAt('Ankorstore'),
    },
    ocula: {
        name: 'Ocula Technologies',
        role: 'Senior Frontend Engineer',
        place: 'Lanyon Place',
        dates: 'Since January 2026',
        // Placeholder until there's more to say
        line: 'Building the interfaces for AI-powered e-commerce.',
        jobs: jobsAt('Ocula Technologies'),
    },
};
