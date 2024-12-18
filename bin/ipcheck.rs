use std::env;
use std::fs::File;
use std::io::Write;
use std::str::FromStr;

use eyre::Result;
use handlebars::Handlebars;
use ipcheck_rs::IpNet;
use ipcheck_rs::IpRange;
use ipcheck_rs::IpTrieNode;
use ipnet::Ipv4Net;
use ipnet::Ipv6Net;
use serde::Serialize;

fn load_csv<N>(path: &str) -> Result<IpRange<N>>
where
    N: IpNet + FromStr,
    <N as FromStr>::Err: core::fmt::Debug,
{
    let mut reader = csv::Reader::from_path(path)?;
    let mut range = reader
        .records()
        .map(|r| r.expect("Invalid CSV record").get(0).unwrap().to_owned())
        .fold(IpRange::new(), |mut range: IpRange<N>, ip| {
            range.add(ip.parse().unwrap());
            range
        });
    range.simplify();
    Ok(range)
}

fn trie_to_nodes(trie: Box<IpTrieNode>) -> Vec<usize> {
    let mut nodes = Vec::new();
    let mut stack = vec![(trie.as_ref(), nodes.len())];
    nodes.extend([0, 0]); // Push root node's left and right indices initially

    while let Some((node, idx)) = stack.pop() {
        let base_idx = idx * 2;

        // Process right child first so it gets lower index
        if let Some(right) = &node.children[1] {
            let right_idx = nodes.len() / 2;
            nodes.extend([0, 0]);
            stack.push((right.as_ref(), right_idx));
            nodes[base_idx + 1] = right_idx;
        }

        // Process left child
        if let Some(left) = &node.children[0] {
            let left_idx = nodes.len() / 2;
            nodes.extend([0, 0]);
            stack.push((left.as_ref(), left_idx));
            nodes[base_idx] = left_idx;
        }
    }

    nodes
}

#[cfg(test)]
fn nodes_to_trie(nodes: Vec<usize>) -> Box<IpTrieNode> {
    let mut cache = std::collections::BTreeMap::new();
    let node_count = nodes.len() / 2;

    for i in (0..node_count).rev() {
        let mut children = [None, None];
        let left_idx = nodes[i * 2];
        let right_idx = nodes[i * 2 + 1];

        if left_idx != 0 {
            children[0] = Some(cache.remove(&left_idx).unwrap());
        }
        if right_idx != 0 {
            children[1] = Some(cache.remove(&right_idx).unwrap());
        }
        cache.insert(i, Box::new(IpTrieNode { children }));
    }

    cache.remove(&0).unwrap()
}

#[derive(Serialize)]
struct IpCheckTemplate {
    #[serde(rename = "filterV4")]
    filter_v4: String,
    #[serde(rename = "filterV6")]
    filter_v6: String,
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        eprintln!(
            "Usage: {} <ipv4_csv_path> <ipv6_csv_path> <output_filename>",
            args[0]
        );
        std::process::exit(1);
    }

    let ipv4_path = &args[1];
    let ipv6_path = &args[2];
    let output_path = &args[3];

    let range: IpRange<Ipv4Net> = load_csv(ipv4_path)?;

    let trie = range.into_trie().into_boxed_node().unwrap();
    let nodes = trie_to_nodes(trie);

    let range_v6: IpRange<Ipv6Net> = load_csv(ipv6_path)?;
    let trie_v6 = range_v6.into_trie().into_boxed_node().unwrap();
    let nodes_v6 = trie_to_nodes(trie_v6);

    let filter_v4 = nodes
        .into_iter()
        .map(|n| n.to_string())
        .collect::<Vec<_>>()
        .join(",");

    let filter_v6 = nodes_v6
        .into_iter()
        .map(|n| n.to_string())
        .collect::<Vec<_>>()
        .join(",");

    let tt = Handlebars::new();
    let code = tt.render_template(
        include_str!("ipcheck.ts"),
        &IpCheckTemplate {
            filter_v4: format!("[{}]", filter_v4),
            filter_v6: format!("[{}]", filter_v6),
        },
    )?;

    let mut file = File::create(output_path)?;
    file.write_all(code.as_bytes())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trie_to_range<N: IpNet>(trie: Box<IpTrieNode>) -> IpRange<N> {
        let mut range = IpRange::<N>::from(trie);
        range.simplify();
        range
    }

    #[test]
    fn test_trie_conversion_roundtrip() {
        // Create a simple IPv4 range for testing
        let mut original_range = IpRange::new();
        original_range.add("192.168.0.0/24".parse::<Ipv4Net>().unwrap());
        original_range.add("10.0.0.0/8".parse::<Ipv4Net>().unwrap());

        // Convert to trie and then to nodes
        let trie = original_range
            .clone()
            .into_trie()
            .into_boxed_node()
            .unwrap();
        let nodes = trie_to_nodes(trie);

        // Convert nodes back to trie and then to range
        let reconstructed_trie = nodes_to_trie(nodes);
        let reconstructed_range = trie_to_range::<Ipv4Net>(reconstructed_trie);

        assert_eq!(original_range, reconstructed_range);
    }

    #[test]
    fn test_single_ip() {
        let mut original_range = IpRange::new();
        original_range.add("192.168.1.1/32".parse::<Ipv4Net>().unwrap());

        let trie = original_range
            .clone()
            .into_trie()
            .into_boxed_node()
            .unwrap();
        let nodes = trie_to_nodes(trie);

        // Convert back and verify
        let reconstructed_trie = nodes_to_trie(nodes);
        let reconstructed_range = trie_to_range::<Ipv4Net>(reconstructed_trie);
        assert_eq!(original_range, reconstructed_range);
    }

    #[test]
    fn test_multiple_ranges() {
        let mut original_range = IpRange::new();
        original_range.add("192.168.0.0/16".parse::<Ipv4Net>().unwrap());
        original_range.add("10.0.0.0/8".parse::<Ipv4Net>().unwrap());
        original_range.add("172.16.0.0/12".parse::<Ipv4Net>().unwrap());

        let trie = original_range
            .clone()
            .into_trie()
            .into_boxed_node()
            .unwrap();
        let nodes = trie_to_nodes(trie);

        // Convert back and verify
        let reconstructed_trie = nodes_to_trie(nodes);
        let reconstructed_range = trie_to_range::<Ipv4Net>(reconstructed_trie);
        assert_eq!(original_range, reconstructed_range);
    }

    #[test]
    fn test_ipv6_conversion() {
        let mut original_range = IpRange::new();
        original_range.add("2001:db8::/32".parse::<Ipv6Net>().unwrap());
        original_range.add("fe80::/10".parse::<Ipv6Net>().unwrap());

        let trie = original_range
            .clone()
            .into_trie()
            .into_boxed_node()
            .unwrap();
        let nodes = trie_to_nodes(trie);

        // Convert back and verify
        let reconstructed_trie = nodes_to_trie(nodes);
        let reconstructed_range = trie_to_range::<Ipv6Net>(reconstructed_trie);
        assert_eq!(original_range, reconstructed_range);
    }
}
