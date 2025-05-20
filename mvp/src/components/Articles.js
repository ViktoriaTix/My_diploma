
const articles = [
    {
        title: "Behavior Problems of the Dog and Cat",
        link: "https://books.google.ru/books?hl=ru&lr=&id=_IOxEAAAQBAJ&oi=fnd&pg=PA369&dq=types+of+destructive+behavior+of+cats&ots=m7f__Be1a3&sig=EogXQdeQGNup76P7I0tkBeCdxBg&redir_esc=y#v=onepage&q=types%20of%20destructive%20behavior%20of%20cats&f=false",
        description: "Книга посвящена поведенческим проблемам, с которыми сталкиваются владельцы собак и кошек. Она рассматривает основные причины таких проблем и предлагает практические советы по их устранению.",
    },
    {
        title: "Utility of a novel activity monitor assessing physical activities and sleep quality in cats",
        link: "https://doi.org/10.1371/journal.pone.0236795",
        description: "Исследование возможностей использования инновационного монитора для измерения физической активности и качества сна у кошек. Рассматриваются преимущества устройства для ветеринарной практики.",
    },
    {
        title: "Ultrasonic Hearing in Cats and Other Terrestrial Mammals",
        link: "https://acousticstoday.org/wp-content/uploads/2021/03/Ultrasonic-Hearing-in-Cats-and-Other-Terrestrial-Mammals-M.-Charlotte-Kruger.pdf",
        description: "Статья посвящена ультразвуковому слуху у кошек и других млекопитающих. Изложены ключевые особенности восприятия звуков высокой частоты и их эволюционное значение.",
    },
    {
        title: "Determination of Absolute‐Intensity Thresholds and Frequency‐Difference Thresholds in Cats",
        link: "https://doi.org/10.1121/1.1908071",
        description: "В этом исследовании анализируются пороговые значения интенсивности и различий частот, воспринимаемых слухом кошек, с целью лучше понять работу их слуховой системы.",
    },
    {
        title: "Guide to a Healthy Cat",
        link: "https://books.google.ru/books?hl=ru&lr=&id=TnruEAAAQBAJ&oi=fnd&pg=PT7&dq=How+Often+Should+You+Feed+Your+Cat%3F&ots=vktx41CDgn&sig=RvmZtiVzQJEM9exD-3jCcCRBCNw&redir_esc=y#v=onepage&q&f=false",
        description: "Это руководство охватывает все аспекты ухода за кошкой, включая питание, гигиену и профилактику заболеваний, что поможет владельцам обеспечить здоровую и долгую жизнь своему питомцу.",
    },
    {
        title: "When fed foods with similar palatability, healthy adult dogs and cats choose different macronutrient compositions",
        link: "https://doi.org/10.1242/jeb.173450",
        description: "Исследование сравнивает выбор макронутриентов у собак и кошек при кормлении одинаково привлекательными по вкусу кормами, выявляя значительные различия в предпочтениях.",
    },
    {
        title: "Comparison of daily distribution of rest/activity in companion cats and dogs",
        link: "https://doi.org/10.1080/09291016.2014.884303",
        description: "В этой статье представлено сравнение ежедневных циклов активности и отдыха у домашних кошек и собак, что может быть полезным для владельцев при планировании ухода.",
    },
    {
        title: "Some nutritional aspects of ageing in dogs and cats",
        link: "https://doi.org/10.1079/PNS19950064",
        description: "Рассматриваются изменения в потребностях в питательных веществах у кошек и собак с возрастом, а также рекомендации по корректировке их диет.",
    },
    {
        title: "Feeding Your Cat: Know the Basics of Feline Nutrition",
        link: "https://www.drsarahskinner.com/wp-content/uploads/2013/08/FeedingYourCat18pages8-10.pdf",
        description: "Документ подробно объясняет основы правильного питания кошек, включая баланс белков, жиров и углеводов, а также советы по выбору кормов.",
    },
];

const ArticlesPage = () => {
    return (
        <div className="documentation-container">
            <h1>Материалы</h1>
            <p className="pets-description">Ссылки на полезные источники, которые помогут вам в уходе за питомцами</p>
            <div className="articles-grid">
                {articles.map((article, index) => (
                    <div className="article-card" key={index}>
                        <a href={article.link} target="_blank" rel="noopener noreferrer" className="article-title">
                            {article.title}
                        </a>
                        <p className="article-description">{article.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ArticlesPage;
