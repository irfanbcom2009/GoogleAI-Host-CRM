import { Client, Publisher, Domain, Journal, ServiceType } from '../types';

export interface Recommendation {
  service: ServiceType;
  title: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  stage: 'Client' | 'Publisher' | 'Domain' | 'Journal';
  requirements?: string[];
  isEligible?: boolean;
}

export const recommendationService = {
  getRecommendations: (
    client: Client,
    publishers: Publisher[],
    domains: Domain[],
    journals: Journal[],
    filterJournalId?: string
  ): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    const subscribedServices = (client.subscriptions || []).map(s => s.service);

    // 1. Client Stage
    if (!filterJournalId && publishers.length === 0) {
      recommendations.push({
        service: 'Editorial Setup',
        title: 'Setup Publisher',
        description: 'Establish your publishing house identity and legal framework.',
        reason: 'You have a client profile but no publisher setup yet.',
        priority: 'high',
        stage: 'Client'
      });
    }

    // 2. Publisher Stage
    if (!filterJournalId && publishers.length > 0 && domains.length === 0) {
      recommendations.push({
        service: 'Domain',
        title: 'Register Domain',
        description: 'Secure a professional web address for your journal.',
        reason: 'Publisher setup is ready. Next step is securing a domain.',
        priority: 'high',
        stage: 'Publisher'
      });
    }

    // 3. Domain Stage
    if (!filterJournalId && domains.length > 0 && journals.length === 0) {
      recommendations.push({
        service: 'OJS',
        title: 'Setup OJS Journal',
        description: 'Install and configure Open Journal Systems for your publication.',
        reason: 'Domain is active. You need a journal platform to start publishing.',
        priority: 'high',
        stage: 'Domain'
      });
    }

    for (const domain of domains) {
      if (!domain.isDomainSubscribedFromUs) {
        recommendations.push({
          service: 'Domain',
          title: `Transfer ${domain.domainName} to Us`,
          description: 'Manage your domain through our platform for better support and integrated billing.',
          reason: 'You have an external domain. Transferring to us simplifies management.',
          priority: 'medium',
          stage: 'Domain'
        });
      }
      if (!domain.isHostingSubscribedFromUs) {
        recommendations.push({
          service: 'Hosting',
          title: `Switch Hosting for ${domain.domainName} to Us`,
          description: 'Professional hosting optimized for OJS and journal management.',
          reason: 'Your hosting is external. Our hosting provides better performance and support.',
          priority: 'medium',
          stage: 'Domain'
        });
      }
    }

    // 4. Journal Stage
    const journalsToProcess = filterJournalId 
      ? journals.filter(j => j.id === filterJournalId)
      : journals;

    for (const journal of journalsToProcess) {
      // OJS Recommendations
      if (!journal.isOjsSubscribedFromUs) {
        recommendations.push({
          service: 'OJS',
          title: `Subscribe OJS for ${journal.title}`,
          description: 'Get professional OJS management and support.',
          reason: 'Your OJS is managed externally. Subscribe through us for full support.',
          priority: 'medium',
          stage: 'Journal'
        });
      }

      // ISSN Recommendations
      if (!journal.issnOnline && !journal.issnPrint) {
        if (!journal.isIssnSubscribedFromUs) {
          recommendations.push({
            service: 'ISSN',
            title: `ISSN for ${journal.title}`,
            description: 'Apply for International Standard Serial Number.',
            reason: 'Essential for journal identification and indexing.',
            priority: 'high',
            stage: 'Journal'
          });
        }
      } else if (!journal.isIssnSubscribedFromUs) {
        recommendations.push({
          service: 'ISSN',
          title: `Manage ISSN for ${journal.title} through Us`,
          description: 'Professional ISSN management and renewal services.',
          reason: 'You have an ISSN but it is not managed through our system.',
          priority: 'low',
          stage: 'Journal'
        });
      }

      // HEC Recommendations
      if (!journal.isHecSubscribedFromUs) {
        recommendations.push({
          service: 'HEC Indexing',
          title: `HEC Recognition for ${journal.title}`,
          description: 'Apply for HEC (Higher Education Commission) recognition.',
          reason: 'Essential for academic recognition in Pakistan.',
          priority: 'high',
          stage: 'Journal'
        });
      }

      // DOI Recommendations
      if (!journal.isDoiSubscribedFromUs) {
        recommendations.push({
          service: 'DOI',
          title: `DOI for ${journal.title}`,
          description: 'Digital Object Identifiers for your articles.',
          reason: 'Essential for citation tracking and permanent links.',
          priority: 'high',
          stage: 'Journal'
        });
      }

      // Post-ISSN Flow (only if subscribed from us)
      if (journal.isIssnSubscribedFromUs) {
        const postIssnServices: { service: ServiceType; title: string; description: string }[] = [
          { service: 'Marketing', title: 'Marketing & Boost', description: 'Increase journal visibility and reach.' },
          { service: 'Call for Papers', title: 'Call for Papers Campaign', description: 'Attract high-quality submissions.' },
          { service: 'Editorial Setup', title: 'Editorial Team Setup', description: 'Professionalize your editorial board.' },
          { service: 'Reviewer Recruitment', title: 'Reviewer Recruitment', description: 'Build a robust peer-review network.' }
        ];

        postIssnServices.forEach(s => {
          if (!subscribedServices.includes(s.service)) {
            recommendations.push({
              ...s,
              reason: 'Journal has ISSN. These services will help drive growth and quality.',
              priority: 'medium',
              stage: 'Journal'
            });
          }
        });

        // Indexing Progression
        const indexingServices: { service: ServiceType; title: string; description: string; requirements: string[] }[] = [
          { service: 'HEC Indexing', title: 'HEC Recognition', description: 'Apply for HEC (Higher Education Commission) recognition.', requirements: ['ISSN Online', 'OJS Setup', 'Editorial Board'] },
          { service: 'DOAJ Indexing', title: 'DOAJ Listing', description: 'Get listed in the Directory of Open Access Journals.', requirements: ['ISSN Online', 'Open Access Policy'] },
          { service: 'Scopus Indexing', title: 'Scopus Indexing', description: 'Apply for Scopus indexing for global reach.', requirements: ['ISSN Online', '2 Years Publication History'] }
        ];

        indexingServices.forEach(s => {
          if (!subscribedServices.includes(s.service)) {
            const hasIssn = !!(journal.issnOnline || journal.issnPrint);
            recommendations.push({
              ...s,
              reason: hasIssn ? 'Journal is ready for professional indexing progression.' : 'Indexing requires an active ISSN. Secure your ISSN first.',
              priority: hasIssn ? 'high' : 'low',
              stage: 'Journal',
              isEligible: hasIssn
            });
          }
        });
      }

      // Evaluation & Growth (Always offered for active journals)
      const growthServices: { service: ServiceType; title: string; description: string }[] = [
        { service: 'Journal Evaluation', title: 'Evaluation Report', description: 'Detailed analysis of journal performance.' },
        { service: 'Site Score', title: 'Site Score Analysis', description: 'Track your journal ranking and impact.' },
        { service: 'Impact Factor', title: 'Impact Factor Evaluation', description: 'Professional assessment of citation impact.' }
      ];

      growthServices.forEach(s => {
        if (!subscribedServices.includes(s.service)) {
          recommendations.push({
            ...s,
            reason: 'Continuous evaluation is key to journal success and ranking.',
            priority: 'low',
            stage: 'Journal',
            isEligible: true
          });
        }
      });
    }

    // Deduplicate and limit recommendations
    const uniqueRecommendations = recommendations.reduce((acc, current) => {
      const x = acc.find(item => item.service === current.service && item.title === current.title);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as Recommendation[]);

    // Sort by priority
    const priorityMap = { high: 0, medium: 1, low: 2 };
    return uniqueRecommendations
      .sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority])
      .slice(0, 6); // Limit to top 6 recommendations
  }
};
