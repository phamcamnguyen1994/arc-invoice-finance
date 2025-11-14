import React from 'react';

const STEP_STYLE = [
  'flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm',
  'transition-transform',
];

const steps = [
  {
    title: '1. Create',
    role: 'SME',
    bullet: 'Issuer submits debtor, face value, due date.',
    code: 'createInvoice',
    result: 'NFT minted • status Draft',
  },
  {
    title: '2. List',
    role: 'SME',
    bullet: 'SME approves marketplace & sets a minimum price.',
    code: 'listInvoice',
    result: 'Marketplace holds NFT • status Listed',
  },
  {
    title: '3. Buy',
    role: 'Investor',
    bullet: 'Investor approves USDC and pays the min price.',
    code: 'buyInvoice',
    result: 'Funds → SME (minus 2% fee) • status Funded',
  },
  {
    title: '4. Settle / Default',
    role: 'Debtor / Settler',
    bullet: 'Debtor repays face value, or privileged account marks default.',
    code: 'settleInvoice / markDefaulted',
    result: 'Investor receives face value (minus fee) • status Settled',
  },
];

export const WorkflowTimeline: React.FC = () => (
  <section className="space-y-4 rounded-xl border border-border bg-background/40 p-6 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-foreground">How it works</h2>
        <p className="text-sm text-muted-foreground">
          Follow the invoice through each on-chain action. Every stage links to a specific contract call and actor.
        </p>
      </div>
      <div className="hidden md:flex items-center text-xs text-muted-foreground uppercase tracking-wide space-x-4">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> SME
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Investor
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Debtor
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Settler/Admin
        </span>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {steps.map(step => (
        <div key={step.title} className={STEP_STYLE.join(' ')}>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {step.title}
          </div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{step.role}</p>
          <p className="text-sm text-muted-foreground">{step.bullet}</p>
          <div className="rounded-md bg-secondary/40 px-3 py-2 text-xs font-mono text-primary">
            {step.code}
          </div>
          <p className="text-sm text-muted-foreground">{step.result}</p>
        </div>
      ))}
    </div>
  </section>
);

