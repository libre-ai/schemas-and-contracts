<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Written for the retained Libre AI portfolio on 2026-09-14; earlier source documents and revisions retain their original licensing. -->

# Libre AI Schemas And Contracts

[Français](README.fr.md)

Services exchanging data need a shared understanding of valid messages and compatible changes. This project explores common schemas and reference examples for developers working across application boundaries. It connects data definitions with the practical questions that arise when producers, consumers and programming languages evolve independently.

## Intended uses

- Check that producers and consumers agree on accepted and rejected payloads.
- Describe compatible changes between versions of a data exchange contract.
- Compare TypeScript and Rust representations with a shared schema and examples.

## Availability

<!-- libre-ai:project-status:begin -->
<!-- Section générée depuis project.v1.yaml — ne pas éditer à la main. -->

- Situation actuelle : Née verte en γ 3.3 (149 commits, 88 entrées de catalogue vérifiées) ; les produits et briques résolvent contrats, fixtures et datalog à travers cette git-dep épinglée.
- Maturité : usable
- Exposition : usable-verifiable
- Confiance : medium
- Preuves vérifiées le : 2026-07-30
- Avancement : 50 % du périmètre actuellement déclaré

<!-- libre-ai:project-status:end -->

The repository includes canonical schemas, TypeScript and Rust validation libraries, and an untrusted-content integrity envelope. Packages can be used separately from a local checkout; no npm or Cargo publication is claimed. See the [installation and verification guide](docs/INSTALLATION.md).

Explore the [Libre AI project catalogue](https://github.com/libre-ai/.github/blob/main/profile/README.md).
