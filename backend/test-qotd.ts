import axios from 'axios';
async function test() {
  const query = `
    query dailyCodingChallengeV2($year: Int!, $month: Int!) {
      dailyCodingChallengeV2(year: $year, month: $month) {
        challenges {
          date
          question {
            title
            titleSlug
          }
        }
      }
    }
  `;
  try {
    const response = await axios.post('https://leetcode.com/graphql/', {
      query,
      variables: { year: 2026, month: 10 }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
