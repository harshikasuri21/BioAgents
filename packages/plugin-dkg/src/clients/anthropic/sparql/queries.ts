export const getKeywordsQuery = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?obj WHERE {
  ?sub <https://schema.org/keywords> ?obj .
}
GROUP BY ?obj`;

export const getAbstractsQuery = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?sub ?abstract WHERE {
  ?sub <https://schema.org/keywords> {{keyword}} .
  ?sub <http://purl.org/dc/terms/abstract> ?abstract
}`;
