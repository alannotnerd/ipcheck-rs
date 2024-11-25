ipcheck-rs
==========

A command-line tool for efficient IP range filtering, built on top of iprange-rs library.

This is a fork of `iprange-rs <https://github.com/sticnarf/iprange-rs>`_ with additional binary functionality, as the original library has unexposed internal fields needed for IP filtering operations.

Features
--------

- Fast IP range lookups using trie-based data structures
- Support for both IPv4 and IPv6 ranges
- CSV file input support
- TypeScript output for web integration
- Memory-efficient storage of large IP ranges
- Direct access to internal trie structures (not available in original library)

Installation
-----------

From source:

.. code-block:: bash

    cargo install --features ipcheck ipcheck-rs

Usage
-----

1. Prepare your IP ranges in CSV format
2. Generate the IP filter:

.. code-block:: bash

    ipcheck input.csv -o ipcheck.ts

3. Use the generated TypeScript module:

.. code-block:: typescript

    import { ipCheck } from './ipcheck';
    
    // Check if an IP is in the range
    console.log(ipCheck('192.168.1.1'));     // IPv4
    console.log(ipCheck('2001:db8::1'));     // IPv6

Performance
----------

The tool inherits the optimized binary trie structure from iprange-rs, providing:

- O(1) lookup time for any IP address
- Minimal memory footprint
- Efficient serialization


Differences from iprange-rs
--------------------------

This fork adds:

- Command-line binary for IP filtering
- Access to internal trie structures
- TypeScript code generation
- CSV processing capabilities

The original library's internal fields were not exposed, making certain IP filtering operations impossible through the public API.

License
-------

MIT License - See LICENSE file for details.

Original work Copyright (c) 2017 Yilin Chen
Modified work Copyright (c) 2024 Alan WANG 

Contributing
-----------

1. Fork the repository
2. Create your feature branch
3. Run tests: ``cargo test --all-features``
4. Submit a Pull Request

The project follows semantic versioning and welcomes contributions.
