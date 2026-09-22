"use client";

import { FormEvent, useState } from "react";

type Field = {
  name: string;
  label: string;
  defaultValue: string;
};

type ApiTesterProps = {
  title: string;
  description: string;
  endpoint: string;
  fields: Field[];
};

export function ApiTester({ title, description, endpoint, fields }: ApiTesterProps) {
  const [result, setResult] = useState("Run the request to inspect its JSON response.");
  const [loading, setLoading] = useState(false);

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    fields.forEach(({ name }) => params.set(name, String(form.get(name) ?? "")));

    try {
      const response = await fetch(`${endpoint}?${params.toString()}`);
      const body: unknown = await response.json();
      setResult(JSON.stringify({ status: response.status, body }, null, 2));
    } catch (error) {
      setResult(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>{title}</h2>
      <p>{description}</p>
      <form onSubmit={run}>
        <div className="form-row">
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              <input name={field.name} defaultValue={field.defaultValue} />
            </label>
          ))}
        </div>
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? "Loading…" : "Fetch data"}
        </button>
      </form>
      <pre>{result}</pre>
    </section>
  );
}
